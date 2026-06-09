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

def send_published_notification_email(order_data: dict):
    """Sends an email to the developer notifying them that their app is published and prompting for InstaPay payment within 3 days."""
    recipient_email = order_data.get('dev_email')
    app_title = order_data.get('app_title')
    total_price = order_data.get('total_price')

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured. Published notification email skipped.")
        try:
            print("==================================================")
            print("       MOCK EMAIL APP PUBLISHED NOTIFICATION      ")
            print("==================================================")
            print(f"To: {recipient_email}")
            print(f"Subject: تهانينا! تم نشر تطبيقك \"{app_title}\" على المتجر 🎉")
            print(f"Payment Deadline: 3 days")
            print(f"Required Amount: {total_price} EGP")
            print(f"Payment Info: {settings.INSTAPAY_DETAILS}")
            print("==================================================")
        except UnicodeEncodeError:
            print("==================================================")
            print("       MOCK EMAIL APP PUBLISHED NOTIFICATION      ")
            print("==================================================")
            print(f"To: {recipient_email}")
            print(f"Subject: Congratulations! your app '{ascii(app_title)}' is published.")
            print(f"Payment Deadline: 3 days")
            print(f"Required Amount: {total_price} EGP")
            print(f"Payment Info: {ascii(settings.INSTAPAY_DETAILS)}")
            print("==================================================")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"تهانينا! تم نشر تطبيقك \"{app_title}\" على المتجر 🎉"
        msg["From"] = settings.SMTP_USER
        msg["To"] = recipient_email

        html = f"""
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: Arial, sans-serif; direction: rtl; text-align: right; line-height: 1.6; color: #1e293b; }}
            .container {{ padding: 20px; border: 2px solid #1e293b; border-radius: 12px; max-width: 600px; margin: 0 auto; box-shadow: 4px 4px 0px #1e293b; background-color: #f8fafc; }}
            .header {{ background-color: #10b981; color: white; padding: 20px; border: 2px solid #1e293b; border-radius: 8px; text-align: center; margin-bottom: 20px; box-shadow: 3px 3px 0px #1e293b; }}
            .header h2 {{ margin: 0; font-size: 1.5rem; }}
            .content {{ padding: 10px; }}
            .payment-card {{ background-color: #fffbeb; border: 2px dashed #d97706; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center; }}
            .amount {{ font-size: 1.5rem; font-weight: bold; color: #b45309; }}
            .footer {{ font-size: 0.9rem; color: #64748b; text-align: center; margin-top: 20px; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>تهانينا! تم نشر تطبيقك بنجاح على المتجر 🚀</h2>
            </div>
            <div class="content">
              <p>مرحباً <strong>{order_data.get('dev_name')}</strong>،</p>
              <p>يسعدنا إبلاغك بأن تطبيقك <strong>"{app_title}"</strong> قد تم نشره بنجاح وأصبح متاحاً الآن على متجر جوجل بلاي!</p>
              <p>وفقاً لسياسة الخدمة لدينا، يرجى إتمام عملية الدفع خلال <strong>3 أيام كحد أقصى</strong> للاستمرار في نشر التطبيق وتجنب حذفه.</p>
              
              <div class="payment-card">
                <p style="margin: 0 0 10px 0;">المبلغ المطلوب سداده:</p>
                <div class="amount">{total_price} ج.م</div>
                <p style="margin: 10px 0 0 0; font-weight: bold;">{settings.INSTAPAY_DETAILS}</p>
              </div>
              
              <p>بمجرد إرسال المبلغ، يرجى إرسال لقطة شاشة للتحويل عبر الواتساب لتأكيد الدفع فوراً.</p>
            </div>
            <div class="footer">
              <p>شكراً لثقتكم بخدماتنا.</p>
            </div>
          </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, recipient_email, msg.as_string())
        
        logger.info("Published notification email sent successfully.")
    except Exception as e:
        logger.error(f"Failed to send published notification email: {e}")

def send_payment_reminder_email(order_data: dict):
    """Sends a warning reminder email to the developer that their 3-day deadline has passed."""
    recipient_email = order_data.get('dev_email')
    app_title = order_data.get('app_title')
    total_price = order_data.get('total_price')

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured. Payment reminder email skipped.")
        try:
            print("==================================================")
            print("       MOCK EMAIL PAYMENT REMINDER WARNING       ")
            print("==================================================")
            print(f"To: {recipient_email}")
            print(f"Subject: تنبيه هام وعاجل: يرجى سداد مستحقات نشر تطبيق \"{app_title}\" لتفادي الحذف")
            print(f"Required Amount: {total_price} EGP")
            print(f"Payment Info: {settings.INSTAPAY_DETAILS}")
            print("==================================================")
        except UnicodeEncodeError:
            print("==================================================")
            print("       MOCK EMAIL PAYMENT REMINDER WARNING       ")
            print("==================================================")
            print(f"To: {recipient_email}")
            print(f"Subject: Urgent: Payment reminder for application '{ascii(app_title)}'")
            print(f"Required Amount: {total_price} EGP")
            print(f"Payment Info: {ascii(settings.INSTAPAY_DETAILS)}")
            print("==================================================")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"تنبيه هام وعاجل: يرجى سداد مستحقات نشر تطبيق \"{app_title}\" لتفادي الحذف ⚠️"
        msg["From"] = settings.SMTP_USER
        msg["To"] = recipient_email

        html = f"""
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: Arial, sans-serif; direction: rtl; text-align: right; line-height: 1.6; color: #1e293b; }}
            .container {{ padding: 20px; border: 2px solid #f43f5e; border-radius: 12px; max-width: 600px; margin: 0 auto; box-shadow: 4px 4px 0px #f43f5e; background-color: #fff1f2; }}
            .header {{ background-color: #f43f5e; color: white; padding: 20px; border: 2px solid #e11d48; border-radius: 8px; text-align: center; margin-bottom: 20px; box-shadow: 3px 3px 0px #e11d48; }}
            .header h2 {{ margin: 0; font-size: 1.5rem; }}
            .content {{ padding: 10px; }}
            .payment-card {{ background-color: #ffffff; border: 2px dashed #f43f5e; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center; }}
            .amount {{ font-size: 1.5rem; font-weight: bold; color: #e11d48; }}
            .footer {{ font-size: 0.9rem; color: #64748b; text-align: center; margin-top: 20px; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>تنبيه هام: انتهاء المهلة المحددة للدفع ⚠️</h2>
            </div>
            <div class="content">
              <p>مرحباً <strong>{order_data.get('dev_name')}</strong>،</p>
              <p>نود إخطارك بأنه قد مضت <strong>3 أيام</strong> منذ نشر تطبيقك <strong>"{app_title}"</strong> على المتجر دون استلام دفعة الاشتراك.</p>
              <p>لضمان استمرار نشر التطبيق وعدم حذفه من حساب المطور الخاص بنا، يرجى سداد المستحقات فوراً عبر InstaPay:</p>
              
              <div class="payment-card">
                <p style="margin: 0 0 10px 0;">المبلغ المطلوب سداده:</p>
                <div class="amount">{total_price} ج.م</div>
                <p style="margin: 10px 0 0 0; font-weight: bold;">{settings.INSTAPAY_DETAILS}</p>
              </div>
              
              <p style="color: #e11d48; font-weight: bold;">في حال عدم تأكيد الدفع خلال 24 ساعة القادمة، سنضطر للبدء في إجراءات حذف التطبيق من المتجر.</p>
            </div>
            <div class="footer">
              <p>إذا كنت قد قمت بالتحويل بالفعل، يرجى تجاهل هذا الإيميل والتواصل معنا عبر الواتساب فوراً لتأكيد الدفع.</p>
            </div>
          </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, recipient_email, msg.as_string())
        
        logger.info("Payment reminder email sent successfully.")
    except Exception as e:
        logger.error(f"Failed to send payment reminder email: {e}")

