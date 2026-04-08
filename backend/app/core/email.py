"""
Email service — sends HTML alerts via SMTP.
Set SMTP_USER, SMTP_PASSWORD, EMAIL_ALERTS_ENABLED=true in Railway env vars.
"""
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List
from .config import settings

logger = logging.getLogger(__name__)


def _build_html(subject: str, sections: List[dict]) -> str:
    """
    sections: [{ title, items: [{label, value, color}], color }]
    """
    SEV_COLOR = {"critica": "#ff3b30", "alta": "#f97316", "media": "#f59e0b", "baja": "#00c96a"}

    rows = ""
    for sec in sections:
        sec_color = sec.get("color", "#00c96a")
        rows += f"""
        <tr>
          <td colspan="2" style="padding:12px 20px 4px;font-size:10px;font-weight:700;
            letter-spacing:1.5px;text-transform:uppercase;color:{sec_color};
            border-top:1px solid #1e293b;">
            {sec['title']}
          </td>
        </tr>"""
        for item in sec.get("items", []):
            ic = item.get("color", "#94a3b8")
            rows += f"""
        <tr style="background:#111827;">
          <td style="padding:10px 20px;font-size:13px;color:#e2e8f0;font-weight:600;">
            {item['label']}
          </td>
          <td style="padding:10px 20px;font-size:12px;color:{ic};font-weight:700;text-align:right;">
            {item['value']}
          </td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
        style="background:#0f172a;border-radius:16px;overflow:hidden;
               border:1px solid #1e293b;box-shadow:0 24px 64px rgba(0,0,0,0.6);">

        <!-- Header -->
        <tr style="background:linear-gradient(135deg,#0a1628,#0f2040);">
          <td colspan="2" style="padding:24px 24px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="background:#00c96a;color:#000;font-size:10px;font-weight:900;
                    letter-spacing:2px;padding:4px 10px;border-radius:6px;">DEPORTE FC</span>
                  <p style="color:#fff;font-size:20px;font-weight:900;margin:12px 0 4px;">
                    {subject}
                  </p>
                  <p style="color:#64748b;font-size:11px;margin:0;">
                    Sistema de alertas automáticas · Confidencial
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Content -->
        <table width="100%" cellpadding="0" cellspacing="0">
          {rows}
        </table>

        <!-- Footer -->
        <tr>
          <td colspan="2" style="padding:16px 20px;border-top:1px solid #1e293b;
            font-size:10px;color:#334155;text-align:center;">
            Deporte FC · Plataforma de Gestión Deportiva · Mensaje automático, no responder
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""
    return html


def send_alert_email(to: str, subject: str, sections: List[dict]) -> bool:
    """Send an HTML alert email. Returns True on success."""
    if not settings.EMAIL_ALERTS_ENABLED:
        logger.info(f"[email] alerts disabled — would send '{subject}' to {to}")
        return False
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("[email] SMTP_USER or SMTP_PASSWORD not configured")
        return False

    html = _build_html(subject, sections)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[Deporte FC] {subject}"
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.sendmail(settings.SMTP_USER, [to], msg.as_string())
        logger.info(f"[email] sent '{subject}' to {to}")
        return True
    except Exception as e:
        logger.error(f"[email] failed to send: {e}")
        return False


def send_bulk_alert(recipients: List[str], subject: str, sections: List[dict]) -> int:
    """Send to multiple recipients. Returns count of successes."""
    return sum(send_alert_email(r, subject, sections) for r in recipients)
