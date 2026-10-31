package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Store keeps a few small named blobs (stats, usage, id sets) so they survive instance restarts.
// Get returns (nil, nil) when the blob does not exist.
type Store interface {
	Get(name string) ([]byte, error)
	Put(name string, data []byte) error
}

// memStore: nothing persisted (local runs).
type memStore struct {
	mu sync.Mutex
	m  map[string][]byte
}

func (s *memStore) Get(n string) ([]byte, error) { s.mu.Lock(); defer s.mu.Unlock(); return s.m[n], nil }
func (s *memStore) Put(n string, d []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.m == nil {
		s.m = map[string][]byte{}
	}
	s.m[n] = append([]byte(nil), d...)
	return nil
}

// fileStore: a directory of files (local testing, or an e2-micro VM with a persistent disk).
type fileStore struct{ dir string }

func (s fileStore) Get(n string) ([]byte, error) {
	b, err := os.ReadFile(filepath.Join(s.dir, n+".dat"))
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	return b, err
}
func (s fileStore) Put(n string, d []byte) error {
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return err
	}
	tmp := filepath.Join(s.dir, n+".tmp")
	if err := os.WriteFile(tmp, d, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(s.dir, n+".dat"))
}

// firestoreStore talks to the Firestore REST API with the Cloud Run service account token from the metadata server.
// No SDK: the binary stays small. Each blob is one document in collection "relay" with a single string field "v".
// Free quota (https://cloud.google.com/firestore/pricing): 1 GiB, 50,000 reads and 20,000 writes per day.
type firestoreStore struct {
	mu      sync.Mutex
	project string
	token   string
	expiry  time.Time
	hc      *http.Client
}

func newFirestoreStore() (*firestoreStore, error) {
	s := &firestoreStore{hc: &http.Client{Timeout: 10 * time.Second}}
	b, err := s.meta("project/project-id")
	if err != nil {
		return nil, err
	}
	s.project = string(b)
	return s, nil
}

func (s *firestoreStore) meta(path string) ([]byte, error) {
	req, _ := http.NewRequest("GET", "http://metadata.google.internal/computeMetadata/v1/"+path, nil)
	req.Header.Set("Metadata-Flavor", "Google")
	r, err := s.hc.Do(req)
	if err != nil {
		return nil, err
	}
	defer r.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if r.StatusCode != 200 {
		return nil, fmt.Errorf("metadata %s: %d", path, r.StatusCode)
	}
	return b, nil
}

func (s *firestoreStore) auth() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.token != "" && time.Now().Before(s.expiry) {
		return s.token, nil
	}
	b, err := s.meta("instance/service-accounts/default/token")
	if err != nil {
		return "", err
	}
	var t struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(b, &t); err != nil {
		return "", err
	}
	s.token = t.AccessToken
	s.expiry = time.Now().Add(time.Duration(t.ExpiresIn-60) * time.Second)
	return s.token, nil
}

func (s *firestoreStore) url(n string) string {
	return "https://firestore.googleapis.com/v1/projects/" + s.project + "/databases/(default)/documents/relay/" + n
}

func (s *firestoreStore) do(method, n string, body []byte) ([]byte, int, error) {
	tok, err := s.auth()
	if err != nil {
		return nil, 0, err
	}
	req, _ := http.NewRequest(method, s.url(n), bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+tok)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	r, err := s.hc.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer r.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	return b, r.StatusCode, nil
}

func (s *firestoreStore) Get(n string) ([]byte, error) {
	b, code, err := s.do("GET", n, nil)
	if err != nil {
		return nil, err
	}
	if code == 404 {
		return nil, nil
	}
	if code != 200 {
		return nil, fmt.Errorf("firestore get %s: %d %.200s", n, code, b)
	}
	var d struct {
		Fields struct {
			V struct {
				S string `json:"stringValue"`
			} `json:"v"`
		} `json:"fields"`
	}
	if err := json.Unmarshal(b, &d); err != nil {
		return nil, err
	}
	return []byte(d.Fields.V.S), nil
}

func (s *firestoreStore) Put(n string, data []byte) error {
	body, _ := json.Marshal(map[string]any{"fields": map[string]any{"v": map[string]string{"stringValue": string(data)}}})
	b, code, err := s.do("PATCH", n, body)
	if err != nil {
		return err
	}
	if code != 200 {
		return fmt.Errorf("firestore put %s: %d %.200s", n, code, b)
	}
	return nil
}
