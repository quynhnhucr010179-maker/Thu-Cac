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

## Dữ liệu và đồng bộ
- Khi chưa đăng nhập, dữ liệu được lưu cục bộ trong trình duyệt.
- Tất cả tài khoản THƯ CÁ đã đăng nhập cùng đọc và đóng góp vào một thư viện chung: truyện, chương, ảnh bìa, metadata video và phụ đề do tài khoản này đăng lên sẽ xuất hiện với tài khoản khác. Tủ sách và tiến độ đọc cũng được lưu trong payload chia sẻ hiện tại.
- THƯ CÁ nhận cập nhật qua Supabase Realtime, đồng thời kiểm tra lại khi người dùng quay lại tab/mở mạng và định kỳ trong lúc trang đang mở.
- Tệp video tải lên được giữ trong IndexedDB để phát ngay trên thiết bị hiện tại và được tải lên bucket Supabase Storage riêng tư để phát trên thiết bị khác. Giới hạn mã nguồn hiện đặt 50 MB/video; dung lượng tổng phụ thuộc hạn mức gói Supabase.
- Video dùng URL trực tiếp, YouTube hoặc Vimeo chỉ đồng bộ đường dẫn và metadata; nhà cung cấp video vẫn quyết định quyền truy cập.
- Hãy xuất JSON định kỳ như một lớp sao lưu bổ sung. Không đưa Supabase Secret/service_role key vào website.
- Nhập chương hàng loạt cần xem trước và kiểm tra thứ tự. OCR chữ Trung in trên video chạy trong trình duyệt, không gửi video lên máy chủ. Bản dịch cần được rà soát trước khi lưu.

## Triển khai
GitHub Actions tự triển khai khi có commit lên nhánh main. Workflow: `.github/workflows/pages.yml`.

## Sao lưu
Trong website, mở **Quản trị nội dung → Sao lưu dữ liệu → Tải bản sao lưu JSON**. Giữ bản sao lưu ở nơi an toàn trước khi nhập dữ liệu mới hoặc đổi trình duyệt.


## Bật đồng bộ lần đầu
1. Tạo hoặc mở project Supabase gói Free.
2. Trong Supabase SQL Editor, chạy toàn bộ file `supabase/schema.sql`. Script tạo bảng thư viện, chính sách RLS, bật Realtime và tạo bucket video riêng tư cùng chính sách truy cập theo tài khoản.
3. Kiểm tra `supabase-config.js` có Project URL và Publishable key đúng. Chỉ dùng publishable key ở trình duyệt; tuyệt đối không dùng Secret/service_role key.
4. Mở THƯ CÁ → Cài đặt → Sao lưu dữ liệu. Tạo tài khoản hoặc đăng nhập; dùng đăng nhập bằng bất kỳ tài khoản nào; các tài khoản cùng dùng kho nội dung chung.
5. Trước lần đồng bộ đầu tiên, xuất JSON dự phòng trên thiết bị đang có dữ liệu. Khi đăng nhập, THƯ CÁ hợp nhất dữ liệu hiện có với thư viện trên đám mây; bản ghi mới hơn được ưu tiên và thao tác xóa được lưu bằng tombstone.
6. Video tải lên chỉ đồng bộ tệp khi đã đăng nhập; giới hạn tải lên hiện đặt 50 MB/video. Tệp quá giới hạn sẽ không tải lên, nhưng metadata và các dữ liệu văn bản vẫn đồng bộ.

## Tiện ích đọc tiếp và dùng khi mất mạng
- Trang Khám phá có khu vực **Đọc tiếp truyện đang theo dõi**, tự lấy chương gần nhất đã mở từ tiến độ đọc đã lưu.
- THƯ CÁ có manifest để cài như ứng dụng web trên trình duyệt tương thích.
- Service worker lưu bộ khung ứng dụng và các tệp giao diện cốt lõi để mở lại trang khi mất mạng sau lần truy cập online đầu tiên. Dữ liệu truyện vẫn dựa vào bộ nhớ trình duyệt hoặc đồng bộ Supabase; video từ URL bên ngoài cần mạng và không được tự tải xuống.
- Trên điện thoại, dùng menu trình duyệt **Thêm vào màn hình chính / Cài đặt ứng dụng** nếu tùy chọn này xuất hiện. Trên Chrome máy tính, dùng biểu tượng cài đặt ở thanh địa chỉ hoặc menu Cài đặt.
