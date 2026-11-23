# THƯ CÁ

Website thư viện truyện và video, triển khai trên GitHub Pages theo hướng local-first, ưu tiên miễn phí.

## Chức năng hiện có trong bản nâng cấp
- Trang khám phá, kho truyện, tìm kiếm theo tên/tác giả, sắp xếp A–Z.
- Quản lý truyện: thêm, sửa, xóa, mô tả, tác giả, trạng thái và ảnh bìa.
- Quản lý chương: thêm, sửa, xóa, đổi thứ tự chương.
- Nhập chương hàng loạt từ TXT/HTML hoặc dán văn bản; tự tách theo một số mẫu tiêu đề chương thông dụng và xem trước trước khi nhập.
- Trang chi tiết truyện, trình đọc chương, chuyển chương trước/sau và tủ sách.
- Quản lý video bằng URL MP4 trực tiếp, YouTube hoặc Vimeo.
- Quản lý phụ đề SRT/VTT: nhập, chỉnh sửa bản gốc và bản tiếng Việt, xuất SRT/VTT.
- Sao lưu toàn bộ dữ liệu JSON và khôi phục từ bản sao lưu.
- Giao diện responsive cho điện thoại và máy tính.

## Mở website
https://quynhnhucr010179-maker.github.io/Thu-Cac/

## Dữ liệu và giới hạn quan trọng
- Dữ liệu được lưu trong localStorage của trình duyệt đang sử dụng. Không tự đồng bộ giữa điện thoại và máy tính, cũng không có đăng nhập hoặc phân quyền quản trị thật.
- Hãy xuất JSON định kỳ. Ảnh bìa được nén nhưng vẫn chiếm dung lượng trình duyệt; nếu bộ nhớ đầy, hãy giảm ảnh hoặc sao lưu.
- Nhập chương hàng loạt là bộ tách theo mẫu tiêu đề phổ biến, không thể bảo đảm nhận diện đúng mọi website/ngôn ngữ. Cần xem trước và kiểm tra thứ tự.
- Video từ YouTube/Vimeo phát qua trình nhúng của nhà cung cấp; MP4 cần là URL truy cập trực tiếp. Không tải video từ nền tảng khác về.
- Phụ đề có thể nhập/chỉnh sửa/xuất SRT/VTT. Bản hiện tại chưa tự nhận diện giọng nói, chưa tự dịch video, chưa tạo giọng đọc và chưa tự căn thời gian phụ đề.
- Chưa có backend, lưu trữ file đám mây, đồng bộ đa thiết bị, tài khoản người dùng hay API dịch.
- Chưa nhập dữ liệu Firestore/Storage của bản Claude Artifact cũ. Cần bản export thực tế để khôi phục đủ 13 truyện và dữ liệu video cũ; README cũ chỉ là danh sách thống kê, không chứa nội dung chương.

## Triển khai
GitHub Actions tự triển khai khi có commit lên nhánh main. Workflow: `.github/workflows/pages.yml`.

## Sao lưu
Trong website, mở **Quản trị nội dung → Sao lưu dữ liệu → Tải bản sao lưu JSON**. Giữ bản sao lưu ở nơi an toàn trước khi nhập dữ liệu mới hoặc đổi trình duyệt.
