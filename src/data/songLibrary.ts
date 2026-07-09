/**
 * Thư viện bản nhạc mẫu — Danh sách các file MusicXML (.mxl) từ MuseTrainer Library.
 * Tất cả các bản nhạc đều dùng định dạng MXL (compressed MusicXML).
 */

export interface SongEntry {
  /** Tên hiển thị của bản nhạc */
  name: string;
  /** URL trực tiếp tới file .mxl */
  url?: string;
  /** Nhạc sĩ / tác giả (tùy chọn) */
  composer?: string;
  /** Mức độ khó (tùy chọn) */
  difficulty?: 'beginner' | 'easy' | 'intermediate' | 'advanced' | 'expert';
  /** Danh sách thẻ bài hát */
  tags?: string[];
  /** Đánh dấu là bài hát tải lên */
  isUploaded?: boolean;
  /** Đánh dấu là bài hát ưa thích */
  isFavorite?: boolean;
  /** Dữ liệu tệp tải lên phục vụ phát nhạc */
  uploadedData?: {
    data: Uint8Array | string;
    type: 'xml' | 'abc' | 'midi';
    midiBytes: Uint8Array;
    rawText: string | null;
  };
}

const songLibraryData: SongEntry[] = [
  // --- Bach ---
  {
    name: 'Air on the G String',
    url: 'https://musetrainer.github.io/library/scores/J._S._Bach_-_Air_on_the_G_String_Piano_arrangement.mxl',
    composer: 'J. S. Bach',
  },
  {
    name: 'Minuet in G Major BWV Anh. 114',
    url: 'https://musetrainer.github.io/library/scores/Bach_Minuet_in_G_Major_BWV_Anh._114.mxl',
    composer: 'J. S. Bach',
    difficulty: 'beginner',
  },
  {
    name: 'Toccata and Fugue in D Minor',
    url: 'https://musetrainer.github.io/library/scores/Bach_Toccata_and_Fugue_in_D_Minor_Piano_solo.mxl',
    composer: 'J. S. Bach',
    difficulty: 'expert',
  },
  {
    name: 'Minuet in G Major',
    url: 'https://musetrainer.github.io/library/scores/Minuet_in_G_Major_Bach.mxl',
    composer: 'J. S. Bach',
    difficulty: 'beginner',
  },
  {
    name: 'G Minor Bach (Original)',
    url: 'https://musetrainer.github.io/library/scores/G_Minor_Bach_Original.mxl',
    composer: 'J. S. Bach',
  },
  {
    name: 'G Minor Bach',
    url: 'https://musetrainer.github.io/library/scores/G_Minor_Bach.mxl',
    composer: 'J. S. Bach',
  },
  {
    name: 'Prelude I in C Major BWV 846',
    url: 'https://musetrainer.github.io/library/scores/Prelude_I_in_C_major_BWV_846_-_Well_Tempered_Clavier_First_Book.mxl',
    composer: 'J. S. Bach',
    difficulty: 'intermediate',
  },
  {
    name: 'Prelude No. 2 in C Minor BWV 847',
    url: 'https://musetrainer.github.io/library/scores/Prelude_No._2_BWV_847_in_C_Minor.mxl',
    composer: 'J. S. Bach',
    difficulty: 'advanced',
  },

  // --- Beethoven ---
  {
    name: 'Für Elise',
    url: 'https://musetrainer.github.io/library/scores/Fur_Elise.mxl',
    composer: 'L. v. Beethoven',
    difficulty: 'intermediate',
  },
  {
    name: 'Für Elise (Easy)',
    url: 'https://musetrainer.github.io/library/scores/Fur_Elise_Easy_Piano.mxl',
    composer: 'L. v. Beethoven',
    difficulty: 'easy',
  },
  {
    name: 'Für Elise (Beginner)',
    url: 'https://musetrainer.github.io/library/scores/Fur_Elise_-_Beethoven_-_for_beginner_piano.mxl',
    composer: 'L. v. Beethoven',
    difficulty: 'beginner',
  },
  {
    name: 'Für Elise (Fingered)',
    url: 'https://musetrainer.github.io/library/scores/Fur_Elise_fingered.mxl',
    composer: 'L. v. Beethoven',
    difficulty: 'intermediate',
  },
  {
    name: 'Moonlight Sonata (3rd Movement)',
    url: 'https://musetrainer.github.io/library/scores/moonlight_sonata_3rd_movement.mxl',
    composer: 'L. v. Beethoven',
    difficulty: 'expert',
  },
  {
    name: 'Symphony No. 5 (1st Movement - Piano)',
    url: 'https://musetrainer.github.io/library/scores/Beethoven_Symphony_No._5_1st_movement_Piano_solo.mxl',
    composer: 'L. v. Beethoven',
    difficulty: 'advanced',
  },
  {
    name: 'Danse Villageoise',
    url: 'https://musetrainer.github.io/library/scores/DANSE_VILLAGEOISE_Beethoven.mxl',
    composer: 'L. v. Beethoven',
    difficulty: 'easy',
  },
  {
    name: 'Ode to Joy (Easy Variation)',
    url: 'https://musetrainer.github.io/library/scores/Ode_to_Joy_Easy_variation.mxl',
    composer: 'L. v. Beethoven',
    difficulty: 'easy',
  },
  {
    name: 'Moonlight Sonata (1st Movement)',
    url: 'https://musetrainer.github.io/library/scores/Sonate_No._14_Moonlight_1st_Movement.mxl',
    composer: 'L. v. Beethoven',
    difficulty: 'intermediate',
  },
  {
    name: 'Moonlight Sonata (3rd Movement - Alternative)',
    url: 'https://musetrainer.github.io/library/scores/Sonate_No._14_Moonlight_3rd_Movement.mxl',
    composer: 'L. v. Beethoven',
    difficulty: 'expert',
  },
  {
    name: 'Pathétique Sonata No. 8 (2nd Movement)',
    url: 'https://musetrainer.github.io/library/scores/Sonate_No._8_Pathetique_2nd_Movement.mxl',
    composer: 'L. v. Beethoven',
    difficulty: 'intermediate',
  },

  // --- Chopin ---
  {
    name: 'Ballade No. 1 in G Minor Op. 23',
    url: 'https://musetrainer.github.io/library/scores/Chopin_-_Ballade_no._1_in_G_minor_Op._23.mxl',
    composer: 'F. Chopin',
    difficulty: 'expert',
  },
  {
    name: 'Nocturne Op. 9 No. 1',
    url: 'https://musetrainer.github.io/library/scores/Chopin_-_Nocturne_Op._9_No._1.mxl',
    composer: 'F. Chopin',
    difficulty: 'advanced',
  },
  {
    name: 'Nocturne Op. 9 No. 2 (Easy)',
    url: 'https://musetrainer.github.io/library/scores/Nocturne_in_E-flat_Major_Op._9_No._2_Easy.mxl',
    composer: 'F. Chopin',
    difficulty: 'easy',
  },
  {
    name: 'Spring Waltz (Marriage d\'Amour)',
    url: 'https://musetrainer.github.io/library/scores/Chopin_-_Spring_Waltz.mxl',
    composer: 'Paul de Senneville',
  },
  {
    name: 'Nocturne Op. 9 No. 2 (Original)',
    url: 'https://musetrainer.github.io/library/scores/Chopin_-_Nocturne_Op_9_No_2_E_Flat_Major.mxl',
    composer: 'F. Chopin',
    difficulty: 'advanced',
  },
  {
    name: 'Nocturne No. 20 in C Minor',
    url: 'https://musetrainer.github.io/library/scores/Nocturne_No._20_in_C_Minor.mxl',
    composer: 'F. Chopin',
    difficulty: 'advanced',
  },
  {
    name: 'Nocturne in C-sharp Minor',
    url: 'https://musetrainer.github.io/library/scores/Nocturne_in_C_sharp_Minor.mxl',
    composer: 'F. Chopin',
    difficulty: 'advanced',
  },
  {
    name: 'Prélude in E Minor Op. 28 No. 4',
    url: 'https://musetrainer.github.io/library/scores/Prlude_Opus_28_No._4_in_E_Minor__Chopin.mxl',
    composer: 'F. Chopin',
    difficulty: 'intermediate',
  },
  {
    name: 'Prélude in E Minor Op. 28 No. 4 (Alternative)',
    url: 'https://musetrainer.github.io/library/scores/Prlude_No._4_in_E_Minor_Op._28_-_Frdric_Chopin.mxl',
    composer: 'F. Chopin',
    difficulty: 'intermediate',
  },
  {
    name: 'Waltz in C-sharp Minor Op. 64 No. 2',
    url: 'https://musetrainer.github.io/library/scores/Waltz_Opus_64_No._2_in_C_Minor.mxl',
    composer: 'F. Chopin',
    difficulty: 'advanced',
  },
  {
    name: 'Waltz in A Minor',
    url: 'https://musetrainer.github.io/library/scores/Waltz_in_A_MinorChopin.mxl',
    composer: 'F. Chopin',
    difficulty: 'intermediate',
  },

  // --- Debussy ---
  {
    name: 'Arabesque No. 1 in E Major',
    url: 'https://musetrainer.github.io/library/scores/Arabesque_L._66_No._1_in_E_Major.mxl',
    composer: 'C. Debussy',
    difficulty: 'advanced',
  },
  {
    name: 'Clair de Lune',
    url: 'https://musetrainer.github.io/library/scores/Clair_de_Lune__Debussy.mxl',
    composer: 'C. Debussy',
    difficulty: 'advanced',
  },
  {
    name: 'Clair de Lune (2)',
    url: 'https://musetrainer.github.io/library/scores/Clair_de_lune_-_Claude_Debussy.mxl',
    composer: 'C. Debussy',
    difficulty: 'advanced',
  },

  // --- Satie ---
  {
    name: 'Gymnopédie No. 1',
    url: 'https://musetrainer.github.io/library/scores/Gymnopdie_No._1__Satie.mxl',
    composer: 'E. Satie',
    difficulty: 'easy',
  },
  {
    name: 'Gymnopédie No. 1 (2)',
    url: 'https://musetrainer.github.io/library/scores/Erik_Satie_-_Gymnopedie_No.1.mxl',
    composer: 'E. Satie',
    difficulty: 'easy',
  },
  {
    name: 'Gnossienne No. 1',
    url: 'https://musetrainer.github.io/library/scores/Gnossienne_No._1.mxl',
    composer: 'E. Satie',
    difficulty: 'intermediate',
  },

  // --- Liszt ---
  {
    name: 'La Campanella',
    url: 'https://musetrainer.github.io/library/scores/La_Campanella_-_Grandes_Etudes_de_Paganini_No._3_-_Franz_Liszt.mxl',
    composer: 'F. Liszt',
    difficulty: 'expert',
  },
  {
    name: 'Liebestraum No. 3 in A♭ Major',
    url: 'https://musetrainer.github.io/library/scores/Liebestraum_No._3_in_A_Major.mxl',
    composer: 'F. Liszt',
    difficulty: 'advanced',
  },
  {
    name: 'Hungarian Sonata',
    url: 'https://musetrainer.github.io/library/scores/Hungarian_Sonata.mxl',
    composer: 'F. Liszt',
    difficulty: 'expert',
  },

  // --- Schubert ---
  {
    name: 'Ave Maria',
    url: 'https://musetrainer.github.io/library/scores/Ave_Maria_D839_-_Schubert_-_Solo_Piano_Arrg..mxl',
    composer: 'F. Schubert',
    difficulty: 'intermediate',
  },
  {
    name: 'Ständchen (Serenade) - Arr. Liszt',
    url: 'https://musetrainer.github.io/library/scores/Schubert_Serenade_-_Standchen_-_By_Lizst.mxl',
    composer: 'F. Schubert',
    difficulty: 'advanced',
  },

  // --- Mozart ---
  {
    name: 'Piano Sonata No. 16 - Allegro',
    url: 'https://musetrainer.github.io/library/scores/Mozart_-_Piano_Sonata_No._16_-_Allegro.mxl',
    composer: 'W. A. Mozart',
    difficulty: 'intermediate',
  },
  {
    name: 'Lacrimosa - Requiem',
    url: 'https://musetrainer.github.io/library/scores/Lacrimosa_-_Requiem.mxl',
    composer: 'W. A. Mozart',
    difficulty: 'advanced',
  },
  {
    name: 'Piano Sonata No. 11 - Rondo alla Turca',
    url: 'https://musetrainer.github.io/library/scores/Piano_Sonata_No._11_K._331_3rd_Movement_Rondo_alla_Turca.mxl',
    composer: 'W. A. Mozart',
    difficulty: 'advanced',
  },
  {
    name: 'Piano Sonata No. 16 (1st Movement - K. 545)',
    url: 'https://musetrainer.github.io/library/scores/Sonata_No._16_1st_Movement_K._545.mxl',
    composer: 'W. A. Mozart',
    difficulty: 'intermediate',
  },
  {
    name: '12 Variations on "Ah vous dirai-je, Maman"',
    url: 'https://musetrainer.github.io/library/scores/12_Variations_of_Twinkle_Twinkle_Little_Star.mxl',
    composer: 'W. A. Mozart',
    difficulty: 'advanced',
  },
  {
    name: 'Turkish March (Fingered)',
    url: 'https://musetrainer.github.io/library/scores/WA_Mozart_Marche_Turque_Turkish_March_fingered.mxl',
    composer: 'W. A. Mozart',
    difficulty: 'advanced',
  },

  // --- Brahms ---
  {
    name: 'Hungarian Dance No. 5 in G Minor',
    url: 'https://musetrainer.github.io/library/scores/Hungarian_Dance_No_5_in_G_Minor.mxl',
    composer: 'J. Brahms',
    difficulty: 'advanced',
  },

  // --- Tchaikovsky ---
  {
    name: 'Dance of the Sugar Plum Fairy',
    url: 'https://musetrainer.github.io/library/scores/Dance_of_the_sugar_plum_fairy.mxl',
    composer: 'P. I. Tchaikovsky',
    difficulty: 'intermediate',
  },
  {
    name: 'Swan Lake (Theme)',
    url: 'https://musetrainer.github.io/library/scores/Swan_Lake.mxl',
    composer: 'P. I. Tchaikovsky',
    difficulty: 'intermediate',
  },
  {
    name: 'Waltz of the Flowers',
    url: 'https://musetrainer.github.io/library/scores/Waltz_of_the_Flowers.mxl',
    composer: 'P. I. Tchaikovsky',
    difficulty: 'advanced',
  },

  // --- Rimsky-Korsakov ---
  {
    name: 'Flight of the Bumblebee',
    url: 'https://musetrainer.github.io/library/scores/Flight_of_the_Bumblebee.mxl',
    composer: 'N. Rimsky-Korsakov',
    difficulty: 'expert',
  },

  // --- Pachelbel ---
  {
    name: 'Canon in D',
    url: 'https://musetrainer.github.io/library/scores/Canon_in_D.mxl',
    composer: 'J. Pachelbel',
    difficulty: 'intermediate',
  },
  {
    name: 'Canon in D (2)',
    url: 'https://musetrainer.github.io/library/scores/Canon_in_D_3.mxl',
    composer: 'J. Pachelbel',
    difficulty: 'intermediate',
  },
  {
    name: 'Canon in D (Easy)',
    url: 'https://musetrainer.github.io/library/scores/Canon_in_D_easy.mxl',
    composer: 'J. Pachelbel',
    difficulty: 'easy',
  },

  // --- Scott Joplin ---
  {
    name: 'Maple Leaf Rag',
    url: 'https://musetrainer.github.io/library/scores/Maple_Leaf_Rag_Scott_Joplin.mxl',
    composer: 'S. Joplin',
    difficulty: 'advanced',
  },
  {
    name: 'The Entertainer',
    url: 'https://musetrainer.github.io/library/scores/The_Entertainer_-_Scott_Joplin.mxl',
    composer: 'S. Joplin',
    difficulty: 'advanced',
  },
  {
    name: 'The Entertainer (1902 Original)',
    url: 'https://musetrainer.github.io/library/scores/The_Entertainer_-_Scott_Joplin_-_1902.mxl',
    composer: 'S. Joplin',
    difficulty: 'advanced',
  },

  // --- Paul de Senneville ---
  {
    name: 'Mariage d\'Amour',
    url: 'https://musetrainer.github.io/library/scores/Mariage_dAmour.mxl',
    composer: 'Paul de Senneville',
    difficulty: 'intermediate',
  },
  {
    name: "Spring Waltz (Mariage d'Amour - Chopin Arr.)",
    url: 'https://musetrainer.github.io/library/scores/Spring_Waltz_Mariage_dAmour_-_Chopin.mxl',
    composer: 'Paul de Senneville',
    difficulty: 'intermediate',
  },

  // --- Nhạc truyền thống / Giáng sinh ---
  {
    name: 'Carol of the Bells',
    url: 'https://musetrainer.github.io/library/scores/Carol_of_the_Bells.mxl',
    composer: 'M. Leontovych',
    difficulty: 'intermediate',
  },
  {
    name: 'Carol of the Bells (Easy)',
    url: 'https://musetrainer.github.io/library/scores/Carol_of_the_Bells_easy_piano.mxl',
    composer: 'M. Leontovych',
    difficulty: 'easy',
  },
  {
    name: 'Greensleeves',
    url: 'https://musetrainer.github.io/library/scores/Greensleeves_for_Piano_easy_and_beautiful.mxl',
    composer: 'Traditional',
    difficulty: 'easy',
  },
  {
    name: 'Happy Birthday To You',
    url: 'https://musetrainer.github.io/library/scores/Happy_Birthday_To_You_Piano.mxl',
    composer: 'Traditional',
    difficulty: 'beginner',
  },
  {
    name: 'Happy Birthday To You (C Major)',
    url: 'https://musetrainer.github.io/library/scores/Happy_Birthday_To_You_C_Major.mxl',
    composer: 'Traditional',
    difficulty: 'beginner',
  },
  {
    name: 'Bella Ciao',
    url: 'https://musetrainer.github.io/library/scores/Bella_Ciao_-_La_Casa_de_Papel.mxl',
    composer: 'Traditional (Italian)',
    difficulty: 'easy',
  },
  {
    name: 'Bella Ciao - Piano',
    url: 'https://musetrainer.github.io/library/scores/Bella_Ciao.mxl',
    composer: 'Traditional (Italian)',
    difficulty: 'easy',
  },

  // --- Handel / Halvorsen ---
  {
    name: 'Passacaglia',
    url: 'https://musetrainer.github.io/library/scores/Passacaglia.mxl',
    composer: 'Handel/Halvorsen',
    difficulty: 'advanced',
  },
  {
    name: 'Passacaglia (Alternative)',
    url: 'https://musetrainer.github.io/library/scores/Passacaglia2.mxl',
    composer: 'Handel/Halvorsen',
    difficulty: 'advanced',
  },
];

export const songLibrary: SongEntry[] = songLibraryData.map(song => ({
  ...song,
  tags: ['có sẵn']
}));

/**
 * Lấy danh sách nhạc sĩ duy nhất từ thư viện.
 */
export function getComposers(): string[] {
  const composerSet = new Set<string>();
  songLibrary.forEach(song => {
    if (song.composer) composerSet.add(song.composer);
  });
  return Array.from(composerSet).sort();
}

/**
 * Lọc bản nhạc theo nhạc sĩ.
 */
export function filterByComposer(composer: string): SongEntry[] {
  return songLibrary.filter(song => song.composer === composer);
}

/**
 * Lọc bản nhạc theo mức độ khó.
 */
export function filterByDifficulty(difficulty: SongEntry['difficulty']): SongEntry[] {
  return songLibrary.filter(song => song.difficulty === difficulty);
}
