import urllib.request
import json
import glob
import os
import csv
import re

headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiY3ZieHZxaWNvd2p0Ymdna2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MTY0MjYsImV4cCI6MjA3NDQ5MjQyNn0.IVT3hOlS12XePDC-hFQIoR79FXdyNxHivpR--Gro8GA',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiY3ZieHZxaWNvd2p0Ymdna2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MTY0MjYsImV4cCI6MjA3NDQ5MjQyNn0.IVT3hOlS12XePDC-hFQIoR79FXdyNxHivpR--Gro8GA',
}

def fetch_all_supabase(table):
    all_rows = []
    offset = 0
    limit = 1000
    while True:
        url = f'https://tbcvbxvqicowjtbggkfa.supabase.co/rest/v1/{table}?select=*&offset={offset}&limit={limit}'
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode())
                all_rows.extend(data)
                if len(data) < limit: break
                offset += limit
        except Exception as e:
            print(f'Error fetching {table}: {e}')
            break
    return all_rows

def clean_phone_raw(p):
    if not p: return ''
    digits = re.sub(r'\D', '', str(p))
    if len(digits) == 10:
        d_10 = digits
    elif len(digits) == 11 and digits.startswith('1'):
        d_10 = digits[1:]
    else:
        return ''
    
    # Filter dummy/invalid numbers
    if d_10 in ['0000000000', '1234567890', '1111111111', '9999999999', '0000034455', '5555555555']:
        return ''
    if len(set(d_10)) == 1:
        return ''
    if d_10.startswith('000') or d_10.startswith('5555'):
        return ''
        
    return '1' + d_10

def format_phone_fb(phone_digits):
    if not phone_digits: return ''
    if len(phone_digits) == 11 and phone_digits.startswith('1'):
        d = phone_digits
        return f'1-({d[1:4]})-{d[4:7]}-{d[7:]}'
    return phone_digits

def clean_email(e):
    if not e: return ''
    e = str(e).strip().lower()
    if '@' in e and '.' in e and not e.startswith('test') and 'dummy' not in e and 'example' not in e:
        return e
    return ''

def parse_name(full_name):
    if not full_name:
        return '', ''
    name = re.sub(r'\s+', ' ', str(full_name)).strip()
    name = name.strip('\"\'')
    if not name:
        return '', ''
    
    parts = name.split(' ')
    if len(parts) == 1:
        return parts[0].capitalize(), ''
    else:
        fn = parts[0].capitalize()
        ln = ' '.join(parts[1:]).capitalize()
        return fn, ln

# Store deduplicated records
records_by_key = {}

def process_record(name, phone, alt_phone=None, email=None, city=None, state='TX', country='US', value=0.0, uid=None, src=''):
    name = (name or '').strip()
    p1 = clean_phone_raw(phone)
    p2 = clean_phone_raw(alt_phone)
    em = clean_email(email)
    
    key = None
    if p1: key = f'phone:{p1}'
    elif p2: key = f'phone:{p2}'
    elif em: key = f'email:{em}'
    elif name and len(name) >= 3: key = f'name:{name.lower()}'
    
    if not key:
        return
        
    if key not in records_by_key:
        records_by_key[key] = {
            'name': name,
            'phones': list(),
            'emails': list(),
            'city': city or 'Beaumont',
            'state': state or 'TX',
            'country': country or 'US',
            'value': 0.0,
            'uid': uid or '',
            'sources': set()
        }
        
    rec = records_by_key[key]
    if name and not rec['name']:
        rec['name'] = name
    if p1 and p1 not in rec['phones']: rec['phones'].append(p1)
    if p2 and p2 not in rec['phones']: rec['phones'].append(p2)
    if em and em not in rec['emails']: rec['emails'].append(em)
    if city and rec['city'] == 'Beaumont': rec['city'] = city
    if uid and not rec['uid']: rec['uid'] = uid
    if src: rec['sources'].add(src)
    
    try:
        if value:
            v_float = float(re.sub(r'[^\d.]', '', str(value)))
            rec['value'] += v_float
    except:
        pass

# 1. Fetch Supabase Data
print("Fetching Supabase tables...")
sb_customers = fetch_all_supabase('customers')
sb_quotes = fetch_all_supabase('quotes')

for c in sb_customers:
    process_record(name=c.get('name'), phone=c.get('phone'), alt_phone=c.get('alt_phone'), email=c.get('email'), city=c.get('location'), uid=c.get('id'), src='supabase_customers')

for q in sb_quotes:
    process_record(name=q.get('customer_name'), phone=q.get('phone'), email=q.get('email'), city=q.get('location'), value=q.get('price'), uid=q.get('id'), src='supabase_quotes')

# 2. Process CSV files
def process_csv_file(path, name_col, phone_col, alt_phone_col=None, email_col=None, value_col=None, city_col=None, uid_col=None, src_name=''):
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.DictReader(f)
        for r in reader:
            n = r.get(name_col, '')
            p = r.get(phone_col, '')
            ap = r.get(alt_phone_col, '') if alt_phone_col else ''
            e = r.get(email_col, '') if email_col else ''
            v = r.get(value_col, '') if value_col else ''
            c = r.get(city_col, '') if city_col else ''
            u = r.get(uid_col, '') if uid_col else ''
            process_record(name=n, phone=p, alt_phone=ap, email=e, city=c, value=v, uid=u, src=src_name)

process_csv_file('/Users/dejohnhandy/Downloads/customers_rows (3).csv', 'name', 'phone', 'alt_phone', 'email', city_col='location', uid_col='id', src_name='csv_customers_3')
process_csv_file('/Users/dejohnhandy/Downloads/customers_rows (1).csv', 'name', 'phone', 'alt_phone', 'email', uid_col='id', src_name='csv_customers_1')
process_csv_file('/Users/dejohnhandy/Downloads/customers_rows (2).csv', 'name', 'phone', 'alt_phone', 'email', city_col='location', uid_col='id', src_name='csv_customers_2')
process_csv_file('/Users/dejohnhandy/Downloads/customers_rows.csv', 'name', 'phone', 'alt_phone', 'email', uid_col='id', src_name='csv_customers')
process_csv_file('/Users/dejohnhandy/Downloads/People.csv', 'Name', 'Phone', email_col='email', value_col='price', src_name='People_csv')
process_csv_file('/Users/dejohnhandy/Downloads/RepairShopData.csv', '\ufeffCustomer Name', 'Customer Phone', email_col='Customer Email', uid_col='Ticket ID', src_name='RepairShopData_csv')
process_csv_file('/Users/dejohnhandy/Downloads/268974_1041073_subscriber_export_2025-12-15.csv', 'full_name', 'phone_number', email_col='email', uid_col='customer_id', src_name='subscriber_csv')

print(f"Total unique customer records processed: {len(records_by_key)}")

# Destination Output Paths
out_paths = [
    '/Users/dejohnhandy/Downloads/facebook_custom_audience_customers.csv',
    '/Users/dejohnhandy/.gemini/antigravity-ide/scratch/elite-phone-repair/facebook_custom_audience_customers.csv'
]

fieldnames = ['email', 'email', 'email', 'phone', 'phone', 'phone', 'madid', 'fn', 'ln', 'zip', 'ct', 'st', 'country', 'dob', 'doby', 'gen', 'age', 'uid', 'value']

output_rows = []

for key, rec in records_by_key.items():
    fn, ln = parse_name(rec['name'])
    
    emails = rec['emails']
    e1 = emails[0] if len(emails) > 0 else ''
    e2 = emails[1] if len(emails) > 1 else ''
    e3 = emails[2] if len(emails) > 2 else ''
    
    phones = [format_phone_fb(p) for p in rec['phones']]
    p1 = phones[0] if len(phones) > 0 else ''
    p2 = phones[1] if len(phones) > 1 else ''
    p3 = phones[2] if len(phones) > 2 else ''
    
    # Must have at least a valid phone or email to be included in Meta audience upload
    if not (p1 or e1):
        continue

    val_str = f"{rec['value']:.2f}" if rec['value'] > 0 else "0"
    
    row = [
        e1, e2, e3,
        p1, p2, p3,
        '', # madid
        fn, ln,
        '', # zip
        rec['city'] or 'Beaumont',
        rec['state'] or 'TX',
        rec['country'] or 'US',
        '', # dob
        '', # doby
        '', # gen
        '', # age
        rec['uid'] or '',
        val_str
    ]
    output_rows.append(row)

for out_p in out_paths:
    with open(out_p, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(fieldnames)
        writer.writerows(output_rows)
    print(f"Saved Facebook Custom Audience CSV to: {out_p}")

print("Done! Total valid rows exported:", len(output_rows))
