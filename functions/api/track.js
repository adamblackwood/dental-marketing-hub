// functions/api/track.js

const SUPABASE_URL = 'SUPABASE_URL';
const SUPABASE_ANON_KEY = 'SUPABASE_ANON_KEY';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

async function supabaseRequest(method, table, query, body = null) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? '?' + query : ''}`;
  const options = { method, headers: supabaseHeaders };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    console.error(`Supabase Error [${method} ${table}]:`, err);
  }
  return res;
}

export async function onRequestPost(context) {
  try {
    // دعم sendBeacon الذي يرسل Blob/FormData بالإضافة لـ JSON العادي
    let payload;
    const contentType = context.request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await context.request.json();
    } else {
      // Fallback بسيط إذا تم إرسالها كنص
      const text = await context.request.text();
      try { payload = JSON.parse(text); } catch(e) { payload = {}; }
    }

    const { type, fingerprint_id, session_id } = payload;

    if (!type || !fingerprint_id || !session_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    switch (type) {
      case 'session_start': {
        let skipStandardUpsert = false;

        // 🚀 منطق الدمج (The Merge) لزوار ABM
        if (payload.uid) {
          const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/visitors?uid=eq.${payload.uid}&select=fingerprint_id`, {
            headers: supabaseHeaders
          });
          const existingVisitors = await checkRes.json();

          if (existingVisitors.length > 0) {
            const existingFp = existingVisitors[0].fingerprint_id;
            // إذا كانت البصمة المسجلة تبدأ بـ cold_ (أي تم إدخاله بواسطة Admin)
            if (existingFp.startsWith('cold_')) {
              // قم بتحديث البصمة الوهمية إلى البصمة الحقيقية للزائر
              const mergeData = {
                fingerprint_id: fingerprint_id,
                last_seen_at: new Date().toISOString(),
                is_identified: true
              };
              if (payload.utm_source) mergeData.first_source = payload.utm_source;
              if (payload.utm_campaign) mergeData.first_utm_campaign = payload.utm_campaign;

              await supabaseRequest('PATCH', 'visitors', `fingerprint_id=eq.${existingFp}`, mergeData);
              skipStandardUpsert = true; // تم الدمج، لا داعي لإنشاء صف جديد
            }
          }
        }

        // الإدراج أو التحديث القياسي (Upsert) للزوار العاديين أو إذا لم يتم العثور على الـ UID
        if (!skipStandardUpsert) {
          const visitorData = {
            fingerprint_id: fingerprint_id,
            last_seen_at: new Date().toISOString(),
            uid: payload.uid || null,
            is_identified: payload.uid ? true : false
          };
          if (payload.utm_source) visitorData.first_source = payload.utm_source;
          if (payload.utm_campaign) visitorData.first_utm_campaign = payload.utm_campaign;

          await supabaseRequest('POST', 'visitors', 'on_conflict=fingerprint_id', visitorData);
        }

        // إنشاء جلسة جديدة
        const sessionData = {
          session_id: session_id,
          fingerprint_id: fingerprint_id,
          entry_page: payload.entry_page || '/',
          started_at: new Date().toISOString(),
          duration_sec: 0,
          max_scroll_pct: 0,
          is_bounce: true,
          exit_page: null
        };
        await supabaseRequest('POST', 'sessions', '', sessionData);
        break;
      }

      case 'heartbeat': {
        const heartbeatData = { duration_sec: payload.duration_sec, is_bounce: false };
        await supabaseRequest('PATCH', 'sessions', `session_id=eq.${session_id}`, heartbeatData);
        break;
      }

      case 'scroll': {
        const scrollData = { max_scroll_pct: payload.max_scroll_pct, is_bounce: false };
        await supabaseRequest('PATCH', 'sessions', `session_id=eq.${session_id}`, scrollData);
        break;
      }

      case 'exit': {
        const exitData = {
          duration_sec: payload.duration_sec,
          max_scroll_pct: payload.max_scroll_pct,
          exit_page: payload.exit_page,
          is_bounce: payload.duration_sec < 10 && payload.max_scroll_pct < 25
        };
        await supabaseRequest('PATCH', 'sessions', `session_id=eq.${session_id}`, exitData);
        await supabaseRequest('PATCH', 'visitors', `fingerprint_id=eq.${fingerprint_id}`, { last_seen_at: new Date().toISOString() });
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid tracking type' }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Tracking Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}