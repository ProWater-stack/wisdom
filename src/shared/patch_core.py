#!/usr/bin/env python3
path = '/Users/ce/Desktop/ProWater Stack/Wisdom2.0-premium-dashboard/src/shared/core.js'
with open(path) as f:
 content = f.read()

old = 'forceRefresh: async () => {\n _memCache.subscriptions = null; _memCache.invoices = null; _memCache.submodules = null;\n _inflight.subscriptions = null; _inflight.invoices = null; _inflight.submodules = null;\n await Promise.all([billingApi.getSubscriptions(true), billingApi.getInvoices(true), billingApi.getSubmodules(true)]);\n },'

new = 'forceRefresh: async () => {\n _memCache.subscriptions = null; _memCache.invoices = null; _memCache.submodules = null; _memCache.plans = null;\n _inflight.subscriptions = null; _inflight.invoices = null; _inflight.submodules = null; _inflight.plans = null;\n await Promise.all([billingApi.getSubscriptions(true), billingApi.getInvoices(true), billingApi.getSubmodules(true), billingApi.getPlans(true)]);\n },\n getPlans: async (force = false) => getCached("plans", "plans", "/admin/subs-module-get-all-plans", async () => {\n const res = await fetch(`${API_ORIGIN}/admin/subs-module-get-all-plans`, { headers: authHeaders() });\n if (!res.ok) throw new Error(`plans ${res.status}`);\n const json = await res.json();\n const raw = json.plans || json.data || (Array.isArray(json) ? json : []);\n return raw.map(r => r.code ? r : mapPlan(r));\n }, Object.values(PLAN_CATALOG), force),'

if old in content:
 content = content.replace(old, new, 1)
 with open(path, 'w') as f:
 f.write(content)
 print('OK')
else:
 print('NOT FOUND')
