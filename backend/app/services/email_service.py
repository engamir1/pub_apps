import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from ..config import settings

logger = logging.getLogger("backend.email")

def send_order_notification_email(order_data: dict):
    """Sends a detailed order notification HTML email to the administrator."""
    # If SMTP is not fully configured, fall back to mock logging (useful for local development)
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning(
            "SMTP credentials not fully configured. Order notification email skipped."
        )
        try:
            print("==================================================")
            print("          MOCK EMAIL ORDER NOTIFICATION           ")
            print("==================================================")
            print(f"To: {settings.NOTIFICATION_EMAIL}")
            print(f"Subject: طلب نشر جديد: {order_data.get('app_title')}")
            print("Order Metadata:")
            for k, v in order_data.items():
                print(f"  {k}: {v}")
            print("==================================================")
        except UnicodeEncodeError:
            # Fallback using ascii() to escape non-ASCII characters on Windows consoles
            print("==================================================")
            print("          MOCK EMAIL ORDER NOTIFICATION           ")
            print("==================================================")
            print(f"To: {settings.NOTIFICATION_EMAIL}")
            print(f"Subject: [New Order Request] {ascii(order_data.get('app_title'))}")
            print("Order Metadata (Safe Representation):")
            for k, v in order_data.items():
                print(f"  {k}: {ascii(v)}")
            print("==================================================")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"طلب نشر جديد: {order_data.get('app_title')}"
        msg["From"] = settings.SMTP_USER
        msg["To"] = settings.NOTIFICATION_EMAIL

        # Build clean RTL HTML template for Arabic reader
        html = f"""
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: Arial, sans-serif; direction: rtl; text-align: right; line-height: 1.6; color: #1e293b; }}
            .container {{ padding: 20px; border: 2px solid #1e293b; border-radius: 12px; max-width: 600px; margin: 0 auto; box-shadow: 4px 4px 0px #1e293b; background-color: #f8fafc; }}
            .header {{ background-color: #6366f1; color: white; padding: 20px; border: 2px solid #1e293b; border-radius: 8px; text-align: center; margin-bottom: 20px; box-shadow: 3px 3px 0px #1e293b; }}
            .header h2 {{ margin: 0; font-size: 1.5rem; }}
            .details-table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
            .details-table th, .details-table td {{ padding: 12px; border-bottom: 1px solid #cbd5e1; text-align: right; }}
            .details-table th {{ background-color: #f1f5f9; font-weight: bold; width: 40%; }}
            .total {{ font-size: 1.3rem; font-weight: bold; color: #f43f5e; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>طلب نشر تطبيق جديد على متجر جوجل بلاي 🚀</h2>
            </div>
            <table class="details-table">
              <tr>
                <th>اسم العميل</th>
                <td>{order_data.get('dev_name')}</td>
              </tr>
              <tr>
                <th>رقم الواتساب</th>
                <td>{order_data.get('dev_phone')}</td>
              </tr>
              <tr>
                <th>البريد الإلكتروني</th>
                <td>{order_data.get('dev_email')}</td>
              </tr>
              <tr>
                <th>الباقة المطلوبة</th>
                <td>{order_data.get('plan_selection')}</td>
              </tr>
              <tr>
                <th>اسم التطبيق</th>
                <td>{order_data.get('app_title')}</td>
              </tr>
              <tr>
                <th>تصنيف التطبيق</th>
                <td>{order_data.get('app_category')}</td>
              </tr>
              <tr>
                <th>الوصف القصير</th>
                <td>{order_data.get('app_short_desc')}</td>
              </tr>
              <tr>
                <th>الوصف الطويل</th>
                <td>{order_data.get('app_long_desc')}</td>
              </tr>
              <tr>
                <th>تجهيز الأصول والـ ASO (+500)</th>
                <td>{"نعم (مطلوب)" if order_data.get('has_aso_addon') else "لا (غير مطلوب)"}</td>
              </tr>
              <tr>
                <th>نقل الملكية (+5500)</th>
                <td>{"نعم (مطلوب)" if order_data.get('has_transfer_addon') else "لا (غير مطلوب)"}</td>
              </tr>
              <tr>
                <th>رابط سياسة الخصوصية</th>
                <td>{order_data.get('privacy_link') or "لا يوجد (سيتم تجهيزها واستضافتها مجاناً)"}</td>
              </tr>
              <tr>
                <th>التكلفة الإجمالية المتوقعة</th>
                <td class="total">{order_data.get('total_price')} ج.م</td>
              </tr>
            </table>
          </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(html, "html", "utf-8"))

        # Connect, authenticate and transmit email
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, settings.NOTIFICATION_EMAIL, msg.as_string())
        
        logger.info("Order notification email sent successfully.")
    except Exception as e:
        logger.error(f"Failed to send order notification email: {e}")
