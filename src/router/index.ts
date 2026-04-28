import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

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
          path: "books/add",
          name: "add-book",
          component: () => import("@/pages/AddBookPage.vue"),
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
  if (to.name === "login" && authStore.user) {
    return { name: "dashboard" };
  }
});

export default router;
