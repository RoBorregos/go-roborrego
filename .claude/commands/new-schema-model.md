# Add a new Prisma model

Model to add: $ARGUMENTS

## Steps

1. Add the model to `prisma/schema.prisma` following this pattern:

```prisma
model <ModelName> {
    id        String   @id @default(cuid())
    // ... fields
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt  // omit if immutable

    // relations
    @@index([<foreignKey>])
}
```

2. Add the reverse relation field on any related models.

3. Run `npm run db:push` — this pushes the schema AND regenerates the Prisma client.

4. **Restart the dev server** — the old process has a stale generated client.

## Important rules
- Always use `@default(cuid())` for string primary keys
- Use `onDelete: Cascade` on relations where child rows should be deleted with parent
- Use `@@unique([a, b])` for join tables, not a separate `id`-based unique
- Prisma client is generated to `generated/prisma/` — import via relative path, NOT `~/generated/prisma`
