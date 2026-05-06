// Route contract for the Anki Review page
// Add inside the auth-guarded layout children array in src/router/index.ts

{
  path: 'anki-review',
  name: 'anki-review',
  component: () => import('@/pages/AnkiReviewPage.vue'),
  meta: { requiresAuth: true },
}
