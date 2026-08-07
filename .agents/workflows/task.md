---
description: Quy trình kiểm thử và xác minh chất lượng mã nguồn Frontend và Rust
---

# Workflow Xác Minh Mã Nguồn (Verification Workflow)

Mỗi khi hoàn thành việc chỉnh sửa mã nguồn, bắt buộc thực hiện các bước xác minh sau tùy thuộc vào thành phần được sửa:

## 1. Đối với thay đổi Frontend (`.ts`, `.vue`, v.v.)
1. Chạy unit tests:
   ```bash
   npm run test
   ```
2. Chạy Type-checking & Production Build:
   ```bash
   npm run build
   ```

## 2. Đối với thay đổi Rust (`.rs`, `Cargo.toml`, v.v.)
1. Kiểm tra biên dịch (Cargo check):
   ```bash
   cargo check --manifest-path crates/synthscore-wasm/Cargo.toml
   ```
2. Kiểm tra cảnh báo linter (Cargo clippy):
   ```bash
   cargo clippy --manifest-path crates/synthscore-wasm/Cargo.toml
   ```
3. Kiểm tra định dạng code (Cargo fmt):
   ```bash
   cargo fmt --manifest-path crates/synthscore-wasm/Cargo.toml -- --check
   ```
4. Kiểm tra unit test Rust (nếu có):
   ```bash
   cargo test --manifest-path crates/synthscore-wasm/Cargo.toml
   ```
5. Kiểm tra tích hợp Frontend với WASM (bắt buộc):
   ```bash
   npm run test
   npm run build
   ```

