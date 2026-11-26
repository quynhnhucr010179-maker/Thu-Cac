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
- Dữ liệu vẫn được lưu cục bộ để ứng dụng hoạt động khi chưa đăng nhập. Phần đồng bộ đám mây Supabase đã được tích hợp trong mã nguồn nhưng chỉ hoạt động sau khi cấu hình dự án Supabase, tạo bảng theo `supabase/schema.sql` và điền Project URL + publishable key vào `supabase-config.js`.
- Khi đồng bộ được bật, truyện, chương, ảnh bìa, metadata video và phụ đề sẽ đồng bộ theo tài khoản. Tệp video tải trực tiếp lên thiết bị vẫn nằm trong IndexedDB của từng thiết bị và không được tải lên đám mây.
- Hãy xuất JSON định kỳ. Ảnh bìa được nén nhưng vẫn chiếm dung lượng trình duyệt; nếu bộ nhớ đầy, hãy giảm ảnh hoặc sao lưu.
- Nhập chương hàng loạt là bộ tách theo mẫu tiêu đề phổ biến, không thể bảo đảm nhận diện đúng mọi website/ngôn ngữ. Cần xem trước và kiểm tra thứ tự.
- Video từ YouTube/Vimeo phát qua trình nhúng của nhà cung cấp; MP4 cần là URL truy cập trực tiếp. Không tải video từ nền tảng khác về.
- Phụ đề có thể nhập/chỉnh sửa/xuất SRT/VTT.
- OCR phụ đề chữ Trung in sẵn trên hình: lấy mẫu khung hình trong trình duyệt, mặc định quét 30% phía dưới, có lựa chọn giản thể/phồn thể và tần suất 0,5–1,5 giây. Giới hạn video 30 phút/lượt; cần kết nối mạng lần đầu để tải thư viện/ngôn ngữ OCR. Người dùng cần rà soát kết quả OCR. Sau khi ghép bản dịch và lưu, trình phát video MP4/WebM có thể hiển thị phụ đề tiếng Việt, tiếng Trung hoặc song ngữ ngay trên khung hình.
- Sau OCR, sao chép danh sách tiếng Trung sang ChatGPT để dịch, dán bản Việt theo thứ tự, ghép và lưu phụ đề song ngữ. Không cần API dịch trả phí; thao tác dịch chưa tự động vì trang tĩnh không có quyền gọi mô hình ChatGPT trong tài khoản người dùng.
- Chưa cấu hình thông tin dự án Supabase thực tế; vì vậy đăng nhập và đồng bộ chưa thể hoạt động cho tới khi có URL/khóa công khai và chạy SQL khởi tạo. Không đưa service_role key vào website.
- Chưa nhập dữ liệu Firestore/Storage của bản Claude Artifact cũ. Cần bản export thực tế để khôi phục đủ 13 truyện và dữ liệu video cũ; README cũ chỉ là danh sách thống kê, không chứa nội dung chương.

## Triển khai
GitHub Actions tự triển khai khi có commit lên nhánh main. Workflow: `.github/workflows/pages.yml`.

## Sao lưu
Trong website, mở **Quản trị nội dung → Sao lưu dữ liệu → Tải bản sao lưu JSON**. Giữ bản sao lưu ở nơi an toàn trước khi nhập dữ liệu mới hoặc đổi trình duyệt.


## Bật đồng bộ lần đầu (cần chủ dự án thực hiện)
1. Tạo một project Supabase ở gói Free: https://supabase.com/dashboard. Gói Free hiện có $0/tháng, 500 MB database, nhưng project có thể tạm dừng sau 1 tuần không hoạt động; giới hạn và điều kiện có thể thay đổi theo nhà cung cấp.
2. Trong Supabase, mở SQL Editor, dán và chạy toàn bộ nội dung file `supabase/schema.sql`.
3. Vào Project Settings → API Keys (hoặc nút Connect), sao chép **Project URL** và **Publishable key** (bắt đầu bằng `sb_publishable_`). Không dùng Secret key hoặc service_role key trong website.
4. Điền hai giá trị đó vào `supabase-config.js`, cập nhật GitHub Pages, rồi vào THƯ CÁ → Quản trị nội dung → Sao lưu dữ liệu → Đồng bộ đám mây.
5. Tạo tài khoản bằng email/mật khẩu trong mục đồng bộ. Đăng nhập đúng tài khoản đó trên cả điện thoại và máy tính. Trước lần đồng bộ đầu tiên, hãy tải JSON dự phòng trên cả thiết bị đang có truyện.

Lưu ý: Supabase Free có thể tự tạm dừng project sau một tuần không hoạt động. Phần đồng bộ này chỉ đồng bộ dữ liệu thư viện dạng JSON; video tải tệp trực tiếp vẫn nằm riêng trên thiết bị. Không gửi mật khẩu Supabase hoặc Secret/service_role key cho bất kỳ ai.
