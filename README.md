# THƯ CÁ

Website đọc truyện và xem video, triển khai dạng static site trên GitHub Pages.

## Hiện có
- Trang khám phá, kho truyện, chi tiết truyện và trình đọc chương.
- Tủ sách lưu trên trình duyệt.
- Danh mục video (hiện nhận URL video).
- Quản trị cơ bản: thêm/xóa truyện, thêm chương đầu, thêm video.
- Nhập/xuất dữ liệu JSON.
- Giao diện responsive cho máy tính và điện thoại.

## Chạy thử
Mở `index.html` bằng trình duyệt hoặc chạy static server tại thư mục dự án.

## Triển khai GitHub Pages
1. Vào **Settings → Pages** trong repository.
2. Chọn **Source: GitHub Actions**.
3. Workflow `.github/workflows/pages.yml` sẽ triển khai khi có commit lên nhánh `main`.
4. Địa chỉ thường có dạng `https://quynhnhucr010179-maker.github.io/Thu-Cac/`.

## Lưu ý dữ liệu và bảo mật
- Phiên bản hiện tại dùng `localStorage`; dữ liệu chỉ lưu trong trình duyệt/thiết bị đang sử dụng, không tự đồng bộ giữa thiết bị.
- Không có đăng nhập thật hoặc phân quyền quản trị server-side. Không dùng cho dữ liệu riêng tư hay mở quyền ghi cho người lạ.
- Không lưu file video dung lượng lớn vào Git repository. Cần lựa chọn object storage/backend miễn phí phù hợp trước khi bật upload video công khai.
- Chưa nhập dữ liệu Firestore/Storage từ bản Claude Artifact cũ. Chỉ nhập dữ liệu cũ sau khi có bản export và kiểm tra cấu trúc.
- Phụ đề tiếng Trung dạng file rời có thể thay bằng track tiếng Việt ở giai đoạn phát video. Chữ Trung đã dính vào hình ảnh cần xử lý video riêng, không thể xóa bằng cách ẩn track phụ đề.

## Cấu trúc
- `index.html`: khung website
- `styles.css`: giao diện
- `app.js`: điều hướng, thư viện, trình đọc và quản trị cơ bản
- `.github/workflows/pages.yml`: tự động deploy GitHub Pages
