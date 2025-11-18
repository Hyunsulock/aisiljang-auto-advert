# Row Level Security (RLS) Policies

## Overview
RLS has been re-enabled on all tables with proper role-based policies for production use.

## Tables and Policies

### 1. agencies
**RLS Status**: ✅ Enabled

**Policies:**
- **Authenticated users can create agencies** (INSERT)
  - Role: `authenticated`
  - With Check: `true`
  - Purpose: Allows any authenticated user to create a new agency

- **Users can view their agency** (SELECT)
  - Role: `public`
  - Qual: `id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid())`
  - Purpose: Users can only view their own agency

- **Admins can update their agency** (UPDATE)
  - Role: `public`
  - Qual: `id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid() AND role = 'admin')`
  - Purpose: Only admins can update agency information

### 2. user_profiles
**RLS Status**: ✅ Enabled

**Policies:**
- **Users can create their own profile** (INSERT)
  - Role: `authenticated`
  - With Check: `id = auth.uid()`
  - Purpose: Users can only create their own profile (id must match auth.uid())

- **Users can view own profile** (SELECT)
  - Role: `public`
  - Qual: `id = auth.uid()`
  - Purpose: Users can only view their own profile

- **Users can update own profile** (UPDATE)
  - Role: `public`
  - Qual: `id = auth.uid()`
  - With Check: `id = auth.uid()`
  - Purpose: Users can only update their own profile

### 3. agency_join_requests
**RLS Status**: ✅ Enabled

**Policies:**
- **Users can create own requests** (INSERT)
  - Role: `public`
  - With Check: `user_id = auth.uid()`
  - Purpose: Users can only create requests for themselves

- **Users can view own requests** (SELECT)
  - Role: `public`
  - Qual: `user_id = auth.uid()`
  - Purpose: Users can only view their own requests

- **Users can update own pending requests** (UPDATE)
  - Role: `public`
  - Qual: `user_id = auth.uid() AND status = 'pending'`
  - Purpose: Users can only update their own pending requests

### 4. machine_id_requests
**RLS Status**: ✅ Enabled

**Policies:**
- **Users can create own machine id requests** (INSERT)
  - Role: `public`
  - With Check: `user_id = auth.uid()`
  - Purpose: Users can only create requests for themselves

- **Users can view own machine id requests** (SELECT)
  - Role: `public`
  - Qual: `user_id = auth.uid()`
  - Purpose: Users can only view their own requests

- **Users can update own pending machine id requests** (UPDATE)
  - Role: `public`
  - Qual: `user_id = auth.uid() AND status = 'pending'`
  - Purpose: Users can only update their own pending requests

## Key Design Decisions

### Why Renderer Process for Database Operations?
All agency/profile creation happens in the Renderer process because:
1. Renderer has JWT authentication context automatically
2. Cannot use Service Role Key in deployed app
3. RLS policies rely on `auth.uid()` which requires JWT

### Role-Based Policies
- INSERT policies use `authenticated` role to ensure only logged-in users can create records
- SELECT/UPDATE policies use `public` role with `auth.uid()` checks for fine-grained control

### Agency Creation Flow
1. User creates agency in Renderer → RLS allows (authenticated user, with_check: true)
2. User creates profile with agency_id → RLS allows (id = auth.uid())
3. Both operations work because JWT is present in Renderer's supabase client

## Testing RLS

To verify RLS is working:

```typescript
// In Renderer - should work
const { data: agency } = await supabase
  .from('agencies')
  .insert({ name: 'Test', subscription_end_date: '2025-12-31', is_active: true })
  .select()
  .single();

// Should only see own agency
const { data: agencies } = await supabase
  .from('agencies')
  .select('*');

// Should only see own profile
const { data: profile } = await supabase
  .from('user_profiles')
  .select('*')
  .single();
```

## Admin Operations

Admins should perform these operations via SQL or Supabase Dashboard:

### Approve Agency Join Request
```sql
-- 1. Get request details
SELECT * FROM agency_join_requests WHERE status = 'pending';

-- 2. Find agency_id
SELECT id FROM agencies WHERE name = 'requested_agency_name';

-- 3. Create user_profile
INSERT INTO user_profiles (id, agency_id, machine_id, role)
VALUES ('user_id_from_request', 'agency_id_from_step_2', NULL, 'member');

-- 4. Mark request as approved
UPDATE agency_join_requests
SET status = 'approved', updated_at = now()
WHERE id = 'request_id';
```

### Approve Machine ID Request
```sql
-- 1. Get request details
SELECT * FROM machine_id_requests WHERE status = 'pending';

-- 2. Update user_profile with machine_id
UPDATE user_profiles
SET machine_id = 'machine_id_from_request', updated_at = now()
WHERE id = 'user_id_from_request';

-- 3. Mark request as approved
UPDATE machine_id_requests
SET status = 'approved', updated_at = now()
WHERE id = 'request_id';
```

## Troubleshooting

### "new row violates row-level security policy"
- Ensure operation is in Renderer process (has JWT)
- Check user is authenticated: `await supabase.auth.getUser()`
- Verify policy role matches (`authenticated` vs `public`)
- Check with_check condition matches insert data

### 406 Not Acceptable
- Don't use `.single()` when data might not exist
- Use `.maybeSingle()` instead for optional queries

### 403 Forbidden
- User doesn't have permission for this operation
- Check policy qual/with_check conditions
- Verify user_id matches auth.uid()
