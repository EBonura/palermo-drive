//! Choosing who each player receives: the K nearest players anywhere, with hysteresis so two players at about the
//! same distance do not keep trading places.

/// `current` is the set held now; `cands` is every other player with a known position and its distance to this
/// one. Returns the new set, in no particular order.
///
/// A member that is still connected stays unless a non-member is at least `hyst` metres nearer than the farthest
/// member. Empty slots are filled with the nearest non-members without any margin.
pub fn select_set(current: &[u16], cands: &[(u16, f32)], k: usize, hyst: f32) -> Vec<u16> {
    let dist = |h: u16| cands.iter().find(|c| c.0 == h).map(|c| c.1);
    // keep current members that still exist, dropping the farthest if the set is somehow over k
    let mut set: Vec<(u16, f32)> = current.iter().filter_map(|&h| dist(h).map(|d| (h, d))).collect();
    set.sort_by(|a, b| a.1.total_cmp(&b.1));
    set.truncate(k);
    let mut outside: Vec<(u16, f32)> = cands.iter().filter(|c| !set.iter().any(|m| m.0 == c.0)).copied().collect();
    outside.sort_by(|a, b| a.1.total_cmp(&b.1));
    let mut outside = outside.into_iter();
    while set.len() < k {
        match outside.next() {
            Some(c) => set.push(c),
            None => break,
        }
    }
    // swaps: the nearest outsider against the farthest member, while the gain is big enough
    for cand in outside {
        let (fi, far) = set.iter().enumerate().max_by(|a, b| a.1 .1.total_cmp(&b.1 .1)).map(|(i, m)| (i, *m)).unwrap_or((0, (0, f32::MAX)));
        if set.is_empty() || far.1 - cand.1 < hyst {
            break; // outsiders come in nearest first, so no later one can do better
        }
        set[fi] = cand;
    }
    set.into_iter().map(|m| m.0).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sorted(mut v: Vec<u16>) -> Vec<u16> {
        v.sort_unstable();
        v
    }

    #[test]
    fn takes_the_nearest_k() {
        let cands: Vec<(u16, f32)> = (1..=20).map(|i| (i, i as f32 * 10.0)).collect();
        assert_eq!(sorted(select_set(&[], &cands, 8, 30.0)), (1..=8).collect::<Vec<u16>>());
    }

    #[test]
    fn fewer_than_k_players_gives_all_of_them() {
        assert_eq!(sorted(select_set(&[], &[(5, 900.0), (6, 10.0)], 8, 30.0)), vec![5, 6]);
        assert!(select_set(&[], &[], 8, 30.0).is_empty());
    }

    #[test]
    fn a_member_is_not_swapped_for_one_barely_nearer() {
        // 1..=8 held at 100..800 m; 9 stands at 790 m: only 10 m nearer than the farthest member, so no swap
        let mut cands: Vec<(u16, f32)> = (1..=8).map(|i| (i, i as f32 * 100.0)).collect();
        cands.push((9, 790.0));
        let cur: Vec<u16> = (1..=8).collect();
        assert_eq!(sorted(select_set(&cur, &cands, 8, 30.0)), cur);
    }

    #[test]
    fn a_much_nearer_outsider_replaces_the_farthest() {
        let mut cands: Vec<(u16, f32)> = (1..=8).map(|i| (i, i as f32 * 100.0)).collect();
        cands.push((9, 769.0)); // 31 m nearer than the member at 800
        let cur: Vec<u16> = (1..=8).collect();
        let got = sorted(select_set(&cur, &cands, 8, 30.0));
        assert_eq!(got, vec![1, 2, 3, 4, 5, 6, 7, 9]);
        // exactly 30 m nearer counts ("at least")
        let mut c2: Vec<(u16, f32)> = (1..=8).map(|i| (i, i as f32 * 100.0)).collect();
        c2.push((9, 770.0));
        assert_eq!(sorted(select_set(&cur, &c2, 8, 30.0)), vec![1, 2, 3, 4, 5, 6, 7, 9]);
    }

    #[test]
    fn several_swaps_in_one_pass_and_each_checks_the_new_farthest() {
        let mut cands: Vec<(u16, f32)> = (1..=8).map(|i| (i, 500.0 + i as f32 * 100.0)).collect(); // 600..1300
        cands.push((20, 10.0));
        cands.push((21, 20.0));
        cands.push((22, 1250.0)); // not 30 m nearer than the (new) farthest member after the others went in
        let cur: Vec<u16> = (1..=8).collect();
        let got = sorted(select_set(&cur, &cands, 8, 30.0));
        assert_eq!(got, vec![1, 2, 3, 4, 5, 6, 20, 21]);
    }

    #[test]
    fn a_member_that_left_is_replaced_without_margin() {
        let cands = vec![(2, 100.0), (3, 105.0), (9, 100.5)];
        // 1 disconnected: 9 and 3 fill from the nearest non-members even though 9 is hardly nearer than anyone
        assert_eq!(sorted(select_set(&[1, 2], &cands, 3, 30.0)), vec![2, 3, 9]);
        assert_eq!(sorted(select_set(&[1, 2], &cands, 2, 30.0)), vec![2, 9]);
    }

    #[test]
    fn a_set_over_k_is_trimmed_to_the_nearest() {
        let cands = vec![(1, 50.0), (2, 10.0), (3, 30.0)];
        assert_eq!(sorted(select_set(&[1, 2, 3], &cands, 2, 30.0)), vec![2, 3]);
    }

    #[test]
    fn stable_when_nothing_changes() {
        let cands: Vec<(u16, f32)> = (1..=30).map(|i| (i, i as f32 * 7.0)).collect();
        let first = select_set(&[], &cands, 8, 30.0);
        assert_eq!(sorted(select_set(&first, &cands, 8, 30.0)), sorted(first));
    }
}
