import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  // 1. Verify the caller is an owner
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can create users' }, { status: 403 })
  }

  // 2. Parse request
  const { email, password, full_name, role } = await req.json()

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'Email, password, and full name are required' }, { status: 400 })
  }

  if (!['owner', 'cashier'].includes(role)) {
    return NextResponse.json({ error: 'Role must be owner or cashier' }, { status: 400 })
  }

  // 3. Create user via admin API (requires service role key)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  })

  if (createErr) {
    return NextResponse.json({ error: createErr.message }, { status: 400 })
  }

  return NextResponse.json({
    id: newUser.user.id,
    email: newUser.user.email,
    full_name,
    role,
  })
}
