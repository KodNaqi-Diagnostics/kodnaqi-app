import re
import os

template = """<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - KodNaqi</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {{
            --bg-dark: #0f172a;
            --bg-surface: #1e293b;
            --primary: #0d3b66;
            --accent: #c9a227;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --border: #334155;
        }}
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Tajawal', sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-main);
            line-height: 1.8;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }}
        .header {{
            background: linear-gradient(135deg, var(--primary), #1e6091);
            padding: 25px 20px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }}
        .header h1 {{ font-size: 1.8rem; color: white; font-weight: 800; }}
        .container {{
            max-width: 800px;
            margin: 30px auto;
            padding: 30px;
            background: var(--bg-surface);
            border-radius: 16px;
            border: 1px solid var(--border);
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            flex-grow: 1;
            width: 90%;
        }}
        .content h2, .content h3 {{
            color: var(--accent);
            margin: 25px 0 15px;
            font-size: 1.3rem;
            border-bottom: 1px solid var(--border);
            padding-bottom: 8px;
        }}
        .content p, .content div {{ margin-bottom: 15px; color: var(--text-muted); font-size: 1.05rem; }}
        .content ul {{ margin-right: 20px; margin-bottom: 15px; color: var(--text-muted); }}
        .content li {{ margin-bottom: 8px; }}
        
        .btn-back {{
            display: inline-block;
            margin-top: 30px;
            padding: 12px 30px;
            background: var(--primary);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 700;
            transition: 0.3s;
            text-align: center;
        }}
        .btn-back:hover {{ background: #1e6091; transform: translateY(-2px); }}
        
        .footer {{ text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.9rem; border-top: 1px solid var(--border); margin-top: auto; }}
    </style>
</head>
<body>

    <div class="header">
        <h1>{title}</h1>
        <p style="color: #cbd5e1; margin-top: 5px;">آخر تحديث: أكتوبر 2026</p>
    </div>

    <div class="container">
        <div class="content">
            {body_content}
        </div>

        <div style="text-align: center;">
            <a href="app.html" class="btn-back">← العودة للتطبيق</a>
        </div>
    </div>

    <div class="footer">
        نظام KodNaqi Diagnostics © 2026 - جميع الحقوق محفوظة
    </div>

</body>
</html>"""

files_to_process = {
    'eula.html': 'اتفاقية الترخيص',
    'contract.html': 'عقد الاستخدام'
}

base_dir = '/data/data/com.termux/files/home/kodnaqi-pwa'

for filename, page_title in files_to_process.items():
    filepath = os.path.join(base_dir, filename)
    if not os.path.exists(filepath):
        print(f'⚠️ تخطي {filename} (الملف غير موجود)')
        continue

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    body_match = re.search(r'<body[^>]*>(.*?)</body>', content, re.DOTALL | re.IGNORECASE)
    if body_match:
        body_content = body_match.group(1).strip()
    else:
        body_content = content.strip()

    body_content = re.sub(r'<script.*?</script>', '', body_content, flags=re.DOTALL | re.IGNORECASE)

    new_html = template.format(title=page_title, body_content=body_content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_html)
        
    print(f'✅ تم تطبيق التصميم الاحترافي على {filename}')
