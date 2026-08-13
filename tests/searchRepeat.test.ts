import { describe, it, expect } from 'vitest';
import { ref, computed } from 'vue';
import { songLibrary, type SongEntry } from '../src/data/songLibrary';

interface FilteredSong extends SongEntry {
  originalIndex: number;
}

describe('Search Query Preservation & Playlist Repeat Mode', () => {
  it('should filter songs based on searchQuery correctly', () => {
    const searchQuery = ref('beethoven');
    const songs = ref<SongEntry[]>(songLibrary.map(s => ({ ...s, isFavorite: false })));

    const filteredSongs = computed<FilteredSong[]>(() => {
      const query = searchQuery.value.toLowerCase().trim();
      const results: FilteredSong[] = [];
      songs.value.forEach((song, idx) => {
        if (query) {
          const haystack = `${song.name} ${song.composer || ''}`.toLowerCase();
          if (!haystack.includes(query)) return;
        }
        results.push({ ...song, originalIndex: idx });
      });
      return results;
    });

    expect(filteredSongs.value.length).toBeGreaterThan(0);
    expect(filteredSongs.value.every(s => 
      s.name.toLowerCase().includes('beethoven') || (s.composer && s.composer.toLowerCase().includes('beethoven'))
    )).toBe(true);
  });

  it('should loop through filteredSongs when repeatMode is all without clearing searchQuery', () => {
    const searchQuery = ref('bach');
    const repeatMode = ref<'off' | 'all' | 'one'>('all');
    const songs = ref<SongEntry[]>(songLibrary.map(s => ({ ...s, isFavorite: false })));

    const filteredSongs = computed<FilteredSong[]>(() => {
      const query = searchQuery.value.toLowerCase().trim();
      const results: FilteredSong[] = [];
      songs.value.forEach((song, idx) => {
        if (query) {
          const haystack = `${song.name} ${song.composer || ''}`.toLowerCase();
          if (!haystack.includes(query)) return;
        }
        results.push({ ...song, originalIndex: idx });
      });
      return results;
    });

    expect(filteredSongs.value.length).toBeGreaterThan(0);

    let selectedSongIndex = filteredSongs.value[0].originalIndex;

    // Simulate song ended event sequence in repeatMode === 'all'
    const simulateSongEnded = () => {
      if (repeatMode.value === 'one') {
        return;
      }
      if (filteredSongs.value.length > 0) {
        const currentFilteredIdx = filteredSongs.value.findIndex(
          s => s.originalIndex === selectedSongIndex
        );
        if (repeatMode.value === 'off' && currentFilteredIdx === filteredSongs.value.length - 1) {
          return;
        }
        let nextFilteredIdx = 0;
        if (currentFilteredIdx !== -1) {
          nextFilteredIdx = (currentFilteredIdx + 1) % filteredSongs.value.length;
        }
        selectedSongIndex = filteredSongs.value[nextFilteredIdx].originalIndex;
      }
    };

    const firstSong = selectedSongIndex;
    
    // Advance through all filtered songs
    for (let i = 0; i < filteredSongs.value.length - 1; i++) {
      simulateSongEnded();
    }
    
    // Now at last song in filtered list
    const lastFilteredIndex = filteredSongs.value.findIndex(s => s.originalIndex === selectedSongIndex);
    expect(lastFilteredIndex).toBe(filteredSongs.value.length - 1);

    // End last song -> should loop back to first filtered song
    simulateSongEnded();
    expect(selectedSongIndex).toBe(firstSong);
    
    // Ensure searchQuery is still preserved
    expect(searchQuery.value).toBe('bach');
  });
});
