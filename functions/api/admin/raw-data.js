// functions/api/admin/raw-data.js
// واجهة جلب البيانات الخام مع Pagination، وتحديث (PATCH)، وحذف (DELETE) لأي جدول
// تستخدم Query Parameters لتحديد الجدول والصفحة والحقل الرئيسي (Primary Key)

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD } from '../../config.js';

// إعدادات الجداول: تحديد المفتاح الرئيسي لكل جدول لاستخدامه في PATCH و DELETE
const TABLE_CONFIG = {
    visitor_profiles: { pk: 'uid' },
    acquisitions: { pk: 'acquisition_id' },
    visits: { pk: 'visit_id' },
    sessions: { pk: 'session_id' },
    email_activities: { pk: 'email_activity_id' },
    events: { pk: 'event_id' }
};

/** التحقق من صلاحيات الأدمن عبر HTTP-only Cookie */
function checkAuth(request) {
    const cookieHeader = request.headers.get('cookie') || '';
    return cookieHeader.includes(`admin_session=${ADMIN_PASSWORD}`);
}

/** بناء رد JSON موحد */
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

// =============================================
// GET: جلب البيانات مع Pagination
// =============================================
export async function onRequestGet(context) {
    if (!checkAuth(context.request)) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    try {
        const url = new URL(context.request.url);
        const table = url.searchParams.get('table');
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = 20; // 20 سجل في الصفحة
        const offset = (page - 1) * limit;

        if (!TABLE_CONFIG[table]) {
            return jsonResponse({ error: 'Invalid table name' }, 400);
        }

        const pk = TABLE_CONFIG[table].pk;

        // طلب البيانات مع إرسال Range header لتفعيل Pagination في Supabase
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/${table}?select=*&order=${pk}.desc.nullslast&offset=${offset}&limit=${limit}`,
            {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Range-Unit': 'items',
                    'Range': `${offset}-${offset + limit - 1}`,
                    'Prefer': 'count=exact' // لجلب العدد الإجمالي في الـ Header
                }
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            console.error(`GET ${table} failed:`, errText);
            return jsonResponse({ error: 'Failed to fetch data' }, res.status);
        }

        const data = await res.json();

        // استخراج العدد الإجمالي من Header يسمى content-range (مثال: items 0-19/150)
        const contentRange = res.headers.get('content-range');
        let totalItems = 0;
        if (contentRange) {
            const parts = contentRange.split('/');
            if (parts.length > 1) totalItems = parseInt(parts[1], 10) || 0;
        }

        return jsonResponse({
            data: data,
            pagination: {
                totalItems: totalItems,
                currentPage: page,
                totalPages: Math.ceil(totalItems / limit),
                limit: limit
            }
        });

    } catch (err) {
        console.error('Raw-data GET exception:', err.message);
        return jsonResponse({ error: 'Internal Server Error' }, 500);
    }
}

// =============================================
// PATCH: تحديث سجل محدد
// =============================================
export async function onRequestPatch(context) {
    if (!checkAuth(context.request)) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    try {
        const url = new URL(context.request.url);
        const table = url.searchParams.get('table');
        const id = url.searchParams.get('id');

        if (!TABLE_CONFIG[table] || !id) {
            return jsonResponse({ error: 'Invalid table or missing id' }, 400);
        }

        const pk = TABLE_CONFIG[table].pk;
        const body = await context.request.json();

        // منع تعديل المفتاح الرئيسي عن طريق الخطأ
        delete body[pk];

        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/${table}?${pk}=eq.${id}`,
            {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(body)
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            console.error(`PATCH ${table} failed:`, errText);
            return jsonResponse({ error: 'Failed to update data' }, res.status);
        }

        const updatedData = await res.json();
        return jsonResponse({ success: true, data: updatedData });

    } catch (err) {
        console.error('Raw-data PATCH exception:', err.message);
        return jsonResponse({ error: 'Internal Server Error' }, 500);
    }
}

// =============================================
// DELETE: حذف سجل محدد
// =============================================
export async function onRequestDelete(context) {
    if (!checkAuth(context.request)) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    try {
        const url = new URL(context.request.url);
        const table = url.searchParams.get('table');
        const id = url.searchParams.get('id');

        if (!TABLE_CONFIG[table] || !id) {
            return jsonResponse({ error: 'Invalid table or missing id' }, 400);
        }

        const pk = TABLE_CONFIG[table].pk;

        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/${table}?${pk}=eq.${id}`,
            {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Prefer': 'return=representation'
                }
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            console.error(`DELETE ${table} failed:`, errText);
            return jsonResponse({ error: 'Failed to delete data' }, res.status);
        }

        return jsonResponse({ success: true });

    } catch (err) {
        console.error('Raw-data DELETE exception:', err.message);
        return jsonResponse({ error: 'Internal Server Error' }, 500);
    }
}