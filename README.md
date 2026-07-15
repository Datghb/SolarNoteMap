# Solar Note Map

`Solar Note Map` là một ứng dụng học tập tương tác viết bằng React + Three.js. Dự án biến mỗi bài học AI thành một hành tinh trong không gian 3D, để người học vừa khám phá nội dung vừa tự tạo sơ đồ kiến thức ngay trong giao diện.

## Mục tiêu dự án

- Trực quan hóa lộ trình học AI cơ bản bằng mô hình vũ trụ.
- Cho phép người học ghi lại ý chính dưới dạng `knowledge map`.
- Tạo cảm giác học tập giàu tương tác thay vì đọc nội dung tĩnh.

## Tính năng chính

- Mô phỏng hệ hành tinh 3D bằng `@react-three/fiber` và `three`.
- Mỗi hành tinh đại diện cho một bài học trong hành trình AI căn bản.
- Bảng học (`LearningConsole`) gồm 3 chế độ:
  - `Nhiệm vụ`: giới thiệu bài học và câu hỏi dẫn đường.
  - `Sơ đồ`: tạo, kéo thả, nối và phân cấp các hạt kiến thức.
  - `Cộng đồng`: hiển thị dữ liệu mẫu về cách học viên khác ghi chú.
- Lưu sơ đồ của từng bài học vào `localStorage`.
- Bật/tắt quỹ đạo và dừng/chạy chuyển động của hệ hành tinh.
- Hiển thị tiến độ sơ đồ đã lưu qua các vệ tinh bay quanh hệ.

## Công nghệ sử dụng

- `React 19`
- `TypeScript`
- `Vite`
- `Three.js`
- `@react-three/fiber`
- `@react-three/drei`
- `Tailwind CSS 4`
- `vite-plugin-singlefile`

## Cài đặt và chạy local

Yêu cầu:

- `Node.js` 18 trở lên
- `npm`

Chạy dự án:

```bash
npm install
npm run dev
```

Sau đó mở `http://localhost:5173`.

Build production:

```bash
npm run build
npm run preview
```

## Cấu trúc thư mục

```text
src/
  components/
    LearningConsole.tsx   # Panel học tập và sơ đồ kiến thức
    SolarSystem.tsx       # Hệ hành tinh và quỹ đạo
    Planet.tsx            # Hành tinh riêng lẻ
    Sun.tsx               # Mặt trời
    SpaceObjects.tsx      # Tinh vân, sao băng, sao chổi...
    PlanetInfo.tsx
    SpaceObjectInfo.tsx
  data/
    lessons.ts            # Nội dung metadata cho các bài học
    spaceObjects.ts
  utils/
    cn.ts
  App.tsx                 # Bố cục chính và điều phối trạng thái
  index.css               # Toàn bộ giao diện
  main.tsx                # Entry point
```

## Dữ liệu bài học hiện có

Hiện tại dự án có 5 bài học:

1. `AI Foundations`
2. `Machine Learning`
3. `Data & Features`
4. `Learning Types`
5. `Neural Networks`

Bạn có thể chỉnh danh sách này trong [src/data/lessons.ts](/Users/apple/SolarNoteMap/src/data/lessons.ts).

## Cách hoạt động của sơ đồ kiến thức

- Mỗi bài học có một map riêng.
- Dữ liệu được lưu theo key dạng `solar-note-map:<lesson-id>` trong `localStorage`.
- Mỗi node gồm:
  - tiêu đề
  - ghi chú
  - mức độ quan trọng
  - vị trí trên board
- Người dùng có thể tạo liên kết giữa các node để thể hiện quan hệ ý tưởng.

## Tùy biến nhanh

Thêm bài học mới:

- cập nhật `LESSONS` trong [src/data/lessons.ts](/Users/apple/SolarNoteMap/src/data/lessons.ts)
- hành tinh sẽ được tạo tự động từ dữ liệu bài học trong [src/components/SolarSystem.tsx](/Users/apple/SolarNoteMap/src/components/SolarSystem.tsx)

Điều chỉnh giao diện chính:

- sửa layout và logic tổng trong [src/App.tsx](/Users/apple/SolarNoteMap/src/App.tsx)
- sửa phong cách hiển thị trong [src/index.css](/Users/apple/SolarNoteMap/src/index.css)

## Ghi chú phát triển

- Dự án hiện đang dùng `vite-plugin-singlefile`, phù hợp nếu muốn xuất gói tĩnh gọn hơn.
- Dữ liệu cộng đồng trong `LearningConsole` đang là mock data.
- Chưa có backend; toàn bộ dữ liệu người học hiện lưu cục bộ trên trình duyệt.

## Hướng mở rộng phù hợp

- Đồng bộ sơ đồ kiến thức lên database.
- Thêm đăng nhập và lưu tiến độ theo tài khoản.
- Mở rộng thêm lesson, quiz hoặc flashcard.
- Cho phép chia sẻ sơ đồ giữa người học.
- Thêm analytics cho hành trình học tập.

## License

Chưa khai báo license chính thức trong repo. Nếu bạn muốn public dự án, nên bổ sung file `LICENSE`.
