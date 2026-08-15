# 🏗️ Kiến trúc & Cấu trúc Thư mục Dự án SynthScore

## 📐 Tổng quan Kiến trúc

SynthScore là một ứng dụng Web tương tác cao cấp dành cho âm thanh & bản nhạc, tích hợp công nghệ **WebAssembly (Rust)**, **Web Audio API (SpessaSynth SoundFont Synthesizer)**, và **Vue 3 Composition API**.

```text
                           [ Web Browser Client ]
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   [ Visual Layer ]          [ Audio Engine ]          [ WASM Backend ]
  Vue 3 + CSS Modules     AudioContext + SpessaSynth    Rust (synthscore-wasm)
   - SheetViewer           - Worklet Synthesizer        - MusicXML to MIDI
   - OrchestraMixer        - SoundFont Loader           - Binary MIDI Parser
   - PlaybackControls      - Offline Audio Exporter     - Audio DSP Exporter
```

---

## 📂 Cấu trúc Thư mục Chi tiết

```text
SynthScore/
├── crates/
│   └── synthscore-wasm/        # Crate Rust WASM backend (midi, xml parser, dsp exporter)
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── midi_processor.rs
│           ├── xml_parser.rs
│           └── audio_dsp.rs
├── public/                     # Tài nguyên tĩnh
│   ├── spessasynth_processor.min.js # AudioWorklet processor của SpessaSynth
│   ├── manifest.json           # Cấu hình PWA Web Manifest
│   └── sw.js                   # Service Worker hỗ trợ chạy offline
├── src/
│   ├── assets/                 # SVGs, hình ảnh, font chữ, CSS dùng chung
│   ├── components/             # Các thành phần giao diện Vue 3
│   │   ├── controls/           # Bộ điều khiển phát nhạc & modal tiện ích dùng chung
│   │   │   ├── AudioSpectrumCanvas.vue # Trực quan hóa phổ âm thanh Canvas
│   │   │   ├── ExportAudioModal.vue    # Modal xuất file audio đa định dạng (WAV, MP3, FLAC, DSD)
│   │   │   ├── FileUploader.vue        # Bộ tải file kéo thả (.midi, .mxl, .abc)
│   │   │   ├── PlaybackControls.vue    # Khung điều khiển phát nhạc chính (Play/Pause/Volume/Speed/Export)
│   │   │   ├── ProgressBar.vue         # Thanh seekbar tiến độ & thời gian phát bài hát
│   │   │   ├── ShortcutsModal.vue      # Modal bảng hướng dẫn phím tắt bàn phím
│   │   │   └── SongLibraryPicker.vue   # Bộ chọn bài hát từ thư viện mẫu
│   │   ├── desktop/            # Giao diện dành riêng cho Desktop (Đối xứng 3 phần)
│   │   │   ├── DesktopControls.vue     # Footer chứa bộ điều khiển phát nhạc Desktop
│   │   │   ├── DesktopHeader.vue       # Header chứa logo, thư viện bài hát, nạp file, status badge
│   │   │   └── DesktopPresentation.vue # Khung trung tâm (Mixer bên trái, toolbar & Sheet/Waterfall bên phải)
│   │   ├── header/             # Sub-components cho header
│   │   │   └── EngineStatusBadge.vue   # Đèn trạng thái & tiến độ tải Soundfont ngoại tuyến
│   │   ├── library/            # Sub-components cho thư viện bài hát
│   │   │   ├── SongCardItem.vue        # Card hiển thị bài hát với nút thả tim, tag, độ khó
│   │   │   └── SongSearchFilter.vue    # Ô tìm kiếm và chip lọc thể loại
│   │   ├── mixer/              # Quản lý bàn trộn âm thanh đa kênh
│   │   │   ├── InstrumentSelector.vue  # Bộ chọn nhạc cụ General MIDI 128 chương trình
│   │   │   ├── MixerHeaderPresets.vue  # Preset Giao hưởng/Concerto & Reverb Master
│   │   │   ├── MixerTrackRow.vue       # Dòng điều khiển Solo/Mute/Volume/Pan/Instrument cho mỗi kênh
│   │   │   ├── OrchestraMixer.vue      # Bàn trộn nhạc cụ chính
│   │   │   └── ReverbSelector.vue      # Bộ chọn kiểu phòng Reverb Master custom dropdown với hiệu ứng Teleport & mượt mà
│   │   ├── mobile/             # Giao diện dành riêng cho thiết bị di động (Responsive Single-Screen)
│   │   │   ├── MobileControls.vue      # Footer chứa bộ điều khiển phát nhạc & drawer nâng cao
│   │   │   ├── MobileHeader.vue        # Header di động
│   │   │   └── MobilePresentation.vue  # Khung trình bày trung tâm di động
│   │   ├── sheet/              # Hiển thị bản nhạc Sheet Music (OSMD / Abcjs)
│   │   │   └── SheetViewer.vue         # Trình hiển thị bản nhạc (OSMD/Abcjs)
│   │   └── visualizer/         # Trực quan hóa âm thanh & đồ họa thác nốt
│   │       └── WaterfallCanvas.vue     # Canvas render thác nốt rơi (Piano Roll)
│   ├── composables/            # Vue Composables tái sử dụng logic
│   │   ├── useKeyboardShortcuts.ts # Quản lý phím tắt bàn phím toàn cục & Toast notification
│   │   └── useResponsive.ts    # Nhận diện thiết bị Mobile / Desktop
│   ├── data/                   # Dữ liệu tĩnh cấu hình
│   │   ├── instruments.ts      # Danh sách nhạc cụ General MIDI & biểu tượng emoji
│   │   └── songLibrary.ts      # Danh sách bài hát mẫu (.mxl)
│   ├── services/               # Dịch vụ xử lý logic nền & Audio Engine
│   │   ├── audio/              # Các dịch vụ con phân tách của Audio Engine
│   │   │   ├── audioContextManager.ts # Quản lý Web Audio Context & Analyser
│   │   │   ├── audioExporter.ts       # Xuất audio kết xuất offline
│   │   │   ├── mediaSessionManager.ts # Tích hợp Media Session API (OS playback controls)
│   │   │   ├── soundfontService.ts    # Tải và đệm nhạc cụ SoundFont
│   │   │   └── trackManager.ts        # Quản lý danh sách track, mute/solo/volume
│   │   ├── audioEngine.ts      # Singleton AudioEngineService chính điều phối âm thanh
│   │   ├── appCache.ts         # Quản lý đệm bài hát và SoundFonts qua IndexedDB
│   │   ├── midiGenerator.ts    # Thuật toán phân tách track & sinh bản phối Giao hưởng / Concerto
│   │   ├── midiWorker.ts       # Web Worker offload xử lý MIDI bằng Rust WASM
│   │   ├── musicXmlParser.ts   # Chuyển đổi MusicXML thô sang tệp nhị phân MIDI
│   │   ├── mxlParser.ts        # Giải nén tệp .mxl lấy MusicXML chuỗi thô
│   │   └── wasmLoader.ts       # Dịch vụ nạp & quản lý module Rust WASM
│   ├── wasm/                   # File WASM và JS binding do wasm-bindgen sinh ra
│   ├── App.vue                 # Giao diện chính của ứng dụng
│   ├── main.ts                 # Điểm khởi tạo Vue App
│   └── style.css               # CSS toàn cục
├── scripts/                    # Các script tiện ích (Tối ưu hóa SoundFont SF3, chuyển đổi audio)
│   ├── trim_sf3.py             # Công cụ CLI cắt gọt & dọn rác SoundFont 3 độc lập
│   └── convert_sf2_to_sf3.py   # Công cụ chuyển đổi SF2 sang SF3 đa luồng (FFmpeg Vorbis)
├── tests/                      # Bộ kiểm thử tự động (Vitest & JSDOM)
├── package.json                # Đăng ký script và thư viện dự án
├── tsconfig.json               # Cấu hình TypeScript
└── vite.config.ts              # Cấu hình Vite & Rolldown Bundler
```
