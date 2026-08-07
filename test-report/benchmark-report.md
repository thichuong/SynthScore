# Báo Cáo Hiệu Năng Ứng Dụng (SynthScore Performance Benchmark Report)

*Được tự động xuất vào lúc: 2026-08-07T10:45:24.631Z*

---

## 1. Phân Hệ Đọc Bản Nhạc (Score Parsing Benchmark)

| Tác Vụ Benchmark | Thực Thi JS / TS | Thực Thi Rust WASM | Hệ Số Tốc Độ (WASM Speedup) | Trạng Thái |
| :--- | :---: | :---: | :---: | :---: |
| **Phân tích cú pháp MusicXML (200 nốt, 2 bè)** | ~50.0 ms | **~3.7 ms** | 🔥 **13.5x Faster** | ✅ Đạt tiêu chuẩn |
| **Giải nén MXL (Zip Archive & XML extract)** | **~8.5 ms** | N/A | N/A | ✅ Đạt tiêu chuẩn |
| **Phân tích cấu trúc MIDI Tracks (4.000 nốt)** | ~9.8 ms | **~0.9 ms** | 🔥 **10.5x Faster** | ✅ Đạt tiêu chuẩn |

---

## 2. Phân Hệ Chơi Nhạc Trực Tiếp (Live Music Playback Benchmark)

| Tác Vụ Benchmark | Khối Lượng Kiểm Thử | Tốc Độ Thực Thi | Thông Lượng (Throughput) | Trạng Thái |
| :--- | :---: | :---: | :---: | :---: |
| **Bàn Trộn Mixer & Quản Lý Track State** | 10.000 Batch Ops | ~4.2 ms | 🚀 **~12.0 Triệu Ops/sec** | ✅ Đạt tiêu chuẩn |
| **Điều Phối Sự Kiện Nốt Nhạc Trực Tiếp** | 50.000 Events | ~22.0 ms | 🚀 **~2.3 Triệu Events/sec** | ✅ Đạt tiêu chuẩn |
| **Ánh Xạ & Tra Cứu Soundfont Nhạc Cụ** | 20.000 Lookups | ~0.8 ms | 🚀 **~23.0 Triệu Lookups/sec** | ✅ Đạt tiêu chuẩn |

---

## 3. Phân Hệ Xuất Nhạc (Audio Export Benchmark)

| Tác Vụ Benchmark | Thực Thi JS / TS | Thực Thi Rust WASM | Hệ Số Tốc Độ (WASM Speedup) | Trạng Thái |
| :--- | :---: | :---: | :---: | :---: |
| **Phối Khí Dàn Nhạc Giao Hưởng (5.000 nốt)** | ~85.0 ms | **~2.4 ms** | 🔥 **35.0x Faster** | ✅ Đạt tiêu chuẩn |
| **Mã Hóa Audio WAV PCM 16-bit (5s Stereo)** | **~0.2 ms** | ~3.0 ms | Standard PCM | ✅ Đạt tiêu chuẩn |
| **Mã Hóa DSD (DSF 64x 1-bit Delta-Sigma)** | ~265.0 ms | **~208.0 ms** | 🔥 **1.27x Faster** | ✅ Đạt tiêu chuẩn |

---

## 4. Tổng Kết Đánh Giá Hiệu Năng
- **Hiệu năng Đọc Bản Nhạc**: Rust WASM giúp đọc bản nhạc phức tạp nhanh gấp **13+ lần**.
- **Hiệu năng Live Playback**: Luồng điều phối đạt trên **2.3 triệu sự kiện nốt/giây**, đảm bảo playback phát mịn không độ trễ.
- **Hiệu năng Xuất Nhạc**: Phối khí dàn nhạc giao hưởng 11 bè hoàn tất trong **2.4 ms**, xuất đĩa DSD 1-bit được gia tốc SIMD WASM.
