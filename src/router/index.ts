import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { ACTIVITY_LOG_ADMIN_ID } from "@/composables/useActivityLog";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: "/",
      component: () => import("@/layouts/DefaultLayout.vue"),
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          name: "dashboard",
          component: () => import("@/pages/DashboardPage.vue"),
        },
        {
          path: "library",
          name: "library",
          component: () => import("@/pages/LibraryPage.vue"),
        },
        {
          path: "library/dnf",
          name: "library-dnf",
          component: () => import("@/pages/DnfListPage.vue"),
        },
        {
          path: "books/add",
          name: "add-book",
          component: () => import("@/pages/AddBookPage.vue"),
        },
        {
          path: "books/add/details/:source/:key(.*)",
          name: "add-book-details",
          component: () => import("@/pages/BookSearchDetailPage.vue"),
        },
        {
          path: "books/:id",
          name: "book-detail",
          component: () => import("@/pages/BookDetailPage.vue"),
          props: true,
        },
        {
          path: "books/:id/recaps",
          name: "recap-history",
          component: () => import("@/pages/RecapHistoryPage.vue"),
          props: true,
        },
        {
          path: "lexicon",
          name: "lexicon",
          component: () => import("@/pages/GreatLibraryPage.vue"),
        },
        {
          path: "books/:id/passport",
          name: "book-passport",
          component: () => import("@/pages/BookPassportPage.vue"),
          props: true,
        },
        {
          path: "profile",
          name: "profile",
          component: () => import("@/pages/ProfilePage.vue"),
        },
        {
          path: "profile/trophy-room",
          name: "trophy-room",
          component: () => import("@/pages/TrophyRoomPage.vue"),
        },
        {
          path: "profile/stats",
          name: "profile-stats",
          component: () => import("@/pages/ReadingStatsPage.vue"),
        },
        {
          path: "profile/edit",
          name: "profile-edit",
          component: () => import("@/pages/ProfileEditPage.vue"),
        },
        {
          path: "anki-review",
          name: "anki-review",
          component: () => import("@/pages/AnkiReviewPage.vue"),
        },
        {
          path: "logging",
          name: "logging",
          component: () => import("@/pages/LoggingPage.vue"),
          meta: { requiresAdmin: true },
        },
      ],
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/pages/AuthPage.vue"),
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: () => import("@/pages/NotFoundPage.vue"),
    },
  ],
});

// Navigation guard — ensure session is restored from localStorage before
// evaluating auth state, so page refresh doesn't bounce users to /auth.
router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  if (!authStore.ready) await authStore.initialize();
  if (to.meta.requiresAuth && !authStore.user) {
    return { name: "login" };
  }
  // Admin-only pages: anyone else lands back on the dashboard. This is a UX
  // guard — the data itself is protected by RLS on activity_logs.
  if (to.meta.requiresAdmin && authStore.user?.id !== ACTIVITY_LOG_ADMIN_ID) {
    return { name: "dashboard" };
  }
  if (to.name === "login" && authStore.user) {
    return { name: "dashboard" };
  }
});

export default router;
