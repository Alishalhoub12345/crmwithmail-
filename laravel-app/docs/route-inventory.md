## Express To Laravel Route Inventory

Current Express API groups discovered in `server/routes.ts`:

- Auth
- Branches
- Users
- Members
- Coaches
- Packages
- Subscriptions
- Classes
- Bookings
- Payments
- Attendance
- Products
- Orders
- Leads
- Lead Tasks
- Diet Plans
- Contact Messages
- Newsletter
- Dashboard Stats

Approximate route count: 50+ endpoints.

### First migration slice created in this scaffold

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/branches`
- `GET /api/branches/{id}`
- `POST /api/branches`
- `PUT /api/branches/{id}`
- `DELETE /api/branches/{id}`
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/{id}`
- `DELETE /api/users/{id}`

### Recommended migration order

1. Auth, roles, branches, users
2. Members, coaches, packages
3. Subscriptions, classes, bookings, attendance
4. Payments, products, orders
5. Leads, lead tasks, diet plans
6. Contact/newsletter/dashboard
