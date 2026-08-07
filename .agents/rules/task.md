---
trigger: always_on
description: Quy tắc kiểm tra và kiểm thử bắt buộc khi chỉnh sửa mã nguồn Frontend và Rust
---

# Quy tắc Verification & Quality Assurance

## 1. Khi sửa đổi code Frontend (.ts, .vue, .js, .css, v.v.)
- **Bắt buộc chạy `npm run test`** để đảm bảo tất cả các bài unit test đều vượt qua.
- **Bắt buộc chạy `npm run build`** (bao gồm `vue-tsc -b` và `vite build`) để đảm bảo không có lỗi TypeScript hay lỗi build.

## 2. Khi sửa đổi code Rust (.rs, Cargo.toml, v.v.)
- **Bắt buộc chạy `cargo check`** (hoặc `cargo check --manifest-path crates/synthscore-wasm/Cargo.toml`) để xác nhận mã Rust biên dịch không lỗi.
- **Bắt buộc chạy `cargo clippy`** (hoặc `cargo clippy --manifest-path crates/synthscore-wasm/Cargo.toml`) để kiểm tra và xử lý các cảnh báo linter.
- **Bắt buộc chạy `cargo fmt`** (hoặc `cargo fmt --check`) để đảm bảo định dạng mã Rust tuân thủ chuẩn.
- **Chạy `cargo test`** nếu có các bài test liên quan đến Rust/WASM.
- **Bắt buộc chạy `npm run test`** và **`npm run build`** để đảm bảo WASM tích hợp chính xác và tất cả test/build Frontend đều thành công.

