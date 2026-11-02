// A few small named blobs (statistics, the month's traffic, id sets) that must survive restarts. The calls block, so callers run
// them on a blocking thread. get returns Ok(None) when the blob does not exist.

#[cfg(test)]
use std::collections::HashMap;
use std::path::PathBuf;
#[cfg(test)]
use std::sync::Mutex;

pub trait Store: Send + Sync {
    fn get(&self, name: &str) -> Result<Option<Vec<u8>>, String>;
    fn put(&self, name: &str, data: &[u8]) -> Result<(), String>;
}

/// Nothing persisted (tests).
#[cfg(test)]
#[derive(Default)]
pub struct MemStore(Mutex<HashMap<String, Vec<u8>>>);

#[cfg(test)]
impl Store for MemStore {
    fn get(&self, name: &str) -> Result<Option<Vec<u8>>, String> {
        Ok(self.0.lock().unwrap().get(name).cloned())
    }
    fn put(&self, name: &str, data: &[u8]) -> Result<(), String> {
        self.0.lock().unwrap().insert(name.to_string(), data.to_vec());
        Ok(())
    }
}

/// A directory of files, one per blob. Each write goes to a temporary file in the same directory and is renamed over the old one,
/// so a crash or a power cut leaves either the old or the new file, never half of one. Copy the directory to back it up.
pub struct FileStore(pub PathBuf);

impl Store for FileStore {
    fn get(&self, name: &str) -> Result<Option<Vec<u8>>, String> {
        match std::fs::read(self.0.join(format!("{name}.dat"))) {
            Ok(b) => Ok(Some(b)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
    fn put(&self, name: &str, data: &[u8]) -> Result<(), String> {
        std::fs::create_dir_all(&self.0).map_err(|e| e.to_string())?;
        let tmp = self.0.join(format!("{name}.tmp"));
        std::fs::write(&tmp, data).map_err(|e| e.to_string())?;
        std::fs::rename(&tmp, self.0.join(format!("{name}.dat"))).map_err(|e| e.to_string())
    }
}
