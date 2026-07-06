# SynthScore - Trình Chơi Nhạc Tự Động & Xem Bản Nhạc Tương Tác Cao Cấp

SynthScore là một ứng dụng web hiện đại được xây dựng trên **Vue 3**, **TypeScript** và **Vite**, mang lại trải nghiệm xem bản nhạc (sheet music) tương tác và tổng hợp âm thanh chất lượng cao ngay trên trình duyệt.

---

## 🚀 Tính năng nổi bật

### 1. 🎼 Trực quan hóa Bản nhạc Tương tác (Sheet Music & Falling Notes)
*   **Hiển thị Bản nhạc truyền thống:** Hỗ trợ kết xuất các định dạng **MusicXML** / **MXL** (compressed MusicXML) thông qua thư viện `OpenSheetMusicDisplay` (OSMD).
*   **Hỗ trợ Định dạng ABC:** Kết xuất bản nhạc cực kỳ nhanh chóng từ mã nguồn định dạng `.abc` thông qua thư viện `abcjs`.
*   **Thác nước Nốt nhạc (Piano Roll Visualizer):** Chế độ hiển thị thác nốt đổ (Falling Notes) tuyệt đẹp trực tiếp trên Canvas, đồng bộ hóa thời gian thực với nhạc đang phát.
*   **Dẫn hướng & Theo dõi trực quan:** Tự động di chuyển dòng kẻ nhạc (auto-scroll) và đánh dấu nốt nhạc/vạch nhịp đang phát.

### 2. 🎛️ Bàn Trộn Âm Thanh Dàn Nhạc (Orchestra Mixer)
*   **Hỗ trợ Đa Kênh (Multi-track):** Hiển thị danh sách toàn bộ các track/kênh nhạc cụ có trong file nhạc.
*   **Tùy biến Nhạc cụ Linh hoạt:** Cho phép thay đổi nhạc cụ của từng kênh dựa trên chuẩn General MIDI (GM Instruments) như Piano, Violin, Cello, Flute, Trumpet, Drums...
*   **Điều khiển Kênh cá nhân:** Tùy chỉnh âm lượng (Volume), Tắt tiếng (Mute), Phát đơn lẻ (Solo) cho từng track/kênh.
*   **Đèn tín hiệu Âm lượng (Voice Level Meter):** Đèn LED nhấp nháy trực quan hóa số lượng nốt/âm thanh đang phát trên từng kênh.
*   **Chế độ Bản phối Thiết lập sẵn (Presets):**
    *   *Mặc định:* Bản phối nguyên bản của tệp tải lên.
    *   *Giao hưởng (Symphony):* Bản phối tối ưu hóa cho dàn nhạc giao hưởng đầy đủ.
    *   *Concerto:* Bản phối tôn vinh nhạc cụ độc tấu (như Piano) và dàn nhạc nền.

### 3. 🔊 Bộ Phát Âm Thanh Chất Lượng Cao & Tùy Chọn SoundFont
*   **Bộ tổng hợp SoundFont:** Sử dụng `spessasynth_lib` hoạt động dựa trên Web Audio API và `AudioWorklet` giúp xử lý âm thanh luồng nền mượt mà, không gây giật lag UI.
*   **Đa dạng tùy chọn SoundFont:** Hỗ trợ lựa chọn bộ tiếng phù hợp với nhu cầu:
    *   *TimGM6mb (Nhẹ - 6MB):* Khởi động tức thì, tối ưu băng thông.
    *   *ChoriumRevA (Tốt - 27MB):* Cân bằng tốt giữa dung lượng và chất lượng nhạc cụ.
    *   *FluidR3_GM (Nặng - 148MB):* Bộ General MIDI chuyên nghiệp chất lượng cao bậc nhất.
    *   *Tùy chỉnh:* Cho phép người dùng kéo thả file `.sf2` cá nhân để phát trực tiếp.
*   **Bộ nhớ đệm thông minh (IndexedDB Cache):** Các file SoundFont và bản nhạc khi tải lần đầu sẽ được lưu vào cơ sở dữ liệu IndexedDB của ứng dụng giúp khởi động và phát ngay lập tức ở lần chạy kế tiếp, đồng thời cho phép sử dụng ngoại tuyến (offline).
*   **Điều khiển phát nhạc đầy đủ:** Phát (Play), Tạm dừng (Pause), Dừng lại (Stop), Tua nhanh/Tua lại (Seeking), Thay đổi tốc độ phát (Playback Rate), và điều chỉnh Âm lượng Tổng (Master Volume).
*   **Tự động khởi tạo:** Khởi động và chuẩn bị bộ tổng hợp ngay khi trang được tải.

### 4. 📚 Thư viện Bản nhạc Mẫu Tích hợp
*   Tích hợp sẵn danh sách phong phú các kiệt tác cổ điển từ Bach, Beethoven, Mozart, Chopin, Vivaldi... được tải trực tiếp từ thư viện MuseTrainer.

### 5. 📂 Tải lên File Tùy chỉnh
*   Hỗ trợ tải lên các tệp tin nhạc của riêng bạn chỉ bằng thao tác kéo thả hoặc chọn tệp. Các định dạng được hỗ trợ:
    *   `.mid`, `.midi` (File nhạc MIDI)
    *   `.xml`, `.mxl` (Bản nhạc MusicXML/Compressed)
    *   `.abc` (Bản nhạc ký âm ABC)
    *   `.sf2` (Bộ nhạc cụ SoundFont tùy chỉnh)

### 6. 📱 Hỗ trợ Progressive Web App (PWA)
*   Cung cấp cấu hình manifest đầy đủ cho phép cài đặt trực tiếp ứng dụng lên điện thoại, máy tính bảng và PC.
*   Tích hợp Service Worker với chiến lược **Stale-While-Revalidate** giúp tải tài nguyên tĩnh siêu tốc và chạy ngoại tuyến hoàn toàn khi không có mạng.

---

## 🛠️ Công nghệ sử dụng

*   **Framework chính:** Vue 3 (Composition API với `<script setup>`)
*   **Ngôn ngữ:** TypeScript
*   **Công cụ build:** Vite
*   **Thư viện âm thanh & nhạc:**
    *   `spessasynth_lib` - Bộ tổng hợp và tuần tự hóa MIDI SoundFont (SoundFont MIDI Synthesizer & Sequencer).
    *   `opensheetmusicdisplay` - Trình kết xuất MusicXML.
    *   `abcjs` - Trình kết xuất ký âm nhạc định dạng ABC.
    *   `@tonejs/midi` - Đọc và phân tích cấu trúc tệp MIDI.
    *   `jszip` - Giải nén các tệp MusicXML nén (`.mxl`).
*   **Icon & Hiệu ứng:** `lucide-vue-next`, `canvas-confetti`

---

## 💻 Cài đặt và Chạy thử nghiệm

### Yêu cầu hệ thống
*   Node.js (phiên bản 18.x trở lên được khuyến nghị)
*   npm hoặc yarn / pnpm

### Các bước cài đặt

1.  **Clone mã nguồn dự án:**
    ```bash
    git clone <url-cua-kho-chua-synthscore>
    cd SynthScore
    ```

2.  **Cài đặt các gói phụ thuộc:**
    ```bash
    npm install
    ```

3.  **Khởi động máy chủ phát triển (Development Server):**
    ```bash
    npm run dev
    ```
    Ứng dụng sẽ chạy tại địa chỉ mặc định `http://localhost:5173/`.

4.  **Biên dịch để triển khai (Build production):**
    ```bash
    npm run build
    ```

---

## 📂 Cấu trúc Thư mục Dự án

```text
SynthScore/
├── public/                     # Tài nguyên tĩnh
│   ├── spessasynth_processor.min.js # File xử lý AudioWorklet của SpessaSynth
│   ├── manifest.json           # Cấu hình PWA Web Manifest
│   └── sw.js                   # Service Worker hỗ trợ chạy offline
├── src/
│   ├── assets/                 # Hình ảnh, font chữ, css chung
│   ├── components/             # Các thành phần giao diện Vue
│   │   ├── FileUploader.vue     # Bộ tải file kéo thả (.midi, .mxl, .abc)
│   │   ├── OrchestraMixer.vue   # Bàn trộn nhạc cụ đa kênh, tùy chỉnh âm lượng, solo, mute
│   │   ├── PlaybackControls.vue # Thanh điều khiển tiến trình phát, bpm, âm lượng tổng
│   │   ├── SheetViewer.vue      # Trình hiển thị bản nhạc (OSMD/Abcjs) & Thác nốt Canvas
│   │   └── SongLibraryPicker.vue# Bộ chọn bài hát từ thư viện mẫu tích hợp
│   ├── data/                   # Dữ liệu tĩnh cấu hình
│   │   ├── instruments.ts      # Danh sách nhạc cụ General MIDI chia nhóm
│   │   └── songLibrary.ts      # Thư viện danh sách bài hát mẫu (.mxl)
│   ├── services/               # Các dịch vụ xử lý logic nền
│   │   ├── audioEngine.ts      # Lớp Singleton quản lý synthesizer, sequencer và âm thanh
│   │   ├── musicXmlParser.ts   # Chuyển đổi tệp tin xml thô sang dữ liệu nhị phân MIDI
│   │   ├── mxlParser.ts        # Giải nén tệp tin mxl để lấy xml thô
│   │   └── appCache.ts         # Quản lý lưu trữ đệm bài hát và SoundFonts ngoại tuyến (IndexedDB)
│   ├── App.vue                 # Giao diện chính ráp nối các bộ phận (Dashboard)
│   ├── main.ts                 # Điểm khởi tạo ứng dụng Vue
│   └── style.css               # Định nghĩa các biến CSS màu sắc, giao diện Glassmorphism
├── package.json                # Khai báo thư viện và script
└── vite.config.ts              # Cấu hình dự án Vite
```

---

## 📖 Hướng dẫn sử dụng

1.  **Khởi động:** Khi truy cập trang web lần đầu, bộ tổng hợp âm thanh sẽ tự động tải các tài nguyên âm thanh (Soundfont) và sẵn sàng phát nhạc. Đèn trạng thái góc trên bên phải sẽ chuyển sang màu xanh **Sẵn sàng (GM Synth)**.
2.  **Chọn nhạc hoặc tải lên:**
    *   Nhấp vào nút **Chọn bài hát từ thư viện** ở góc trên bên phải để chọn các tác phẩm cổ điển có sẵn.
    *   Hoặc nhấp/kéo-thả tệp nhạc `.mid`, `.mxl`, `.abc` của bạn vào khu vực **Tải bản nhạc lên**.
3.  **Điều khiển phát nhạc:** Sử dụng bảng điều khiển ở dưới đáy màn hình để Phát, Tạm dừng, thay đổi tốc độ hoặc điều chỉnh âm lượng tổng.
4.  **Sử dụng Bàn trộn:**
    *   Tại cột trái, bạn sẽ thấy danh sách tất cả các track/nhạc cụ.
    *   Bạn có thể thay đổi nhạc cụ bằng danh sách thả xuống (ví dụ: chuyển từ Acoustic Grand Piano sang Violin hay Church Organ).
    *   Bật **S** (Solo) để chỉ nghe kênh đó, hoặc bật **M** (Mute) để tắt tiếng kênh đó.
    *   Thay đổi âm lượng của từng kênh độc lập.
    *   Thử các preset **Giao hưởng** hoặc **Concerto** để thay đổi nhanh phối âm của bài hát.
5.  **Xem bản nhạc & Thác nốt:**
    *   Chọn tab **Bản Nhạc** để xem ký âm dạng nốt nhạc chuẩn.
    *   Chọn tab **Thác Nốt Nhạc** để xem hiệu ứng thác nước 3D đổ các nốt nhạc xuống bàn phím ảo.

---

## 🤝 Đóng góp ý kiến & Phát triển thêm

Mọi ý kiến đóng góp, báo lỗi hoặc yêu cầu tính năng mới xin vui lòng tạo Issue hoặc gửi Pull Request cho dự án.

Chúc bạn có những trải nghiệm tuyệt vời cùng **SynthScore**! 🎵
