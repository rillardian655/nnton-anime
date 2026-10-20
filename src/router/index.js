import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import WatchView from '../views/WatchView.vue';
import AdminView from '../views/AdminView.vue';
import InviteView from '../views/InviteView.vue';

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/watch',
    name: 'watch',
    component: WatchView
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminView
  },
  {
    path: '/invite',
    name: 'invite',
    component: InviteView
  },
  {
    path: '/anime',
    redirect: to => ({ path: '/watch', query: to.query })
  },
  {
    path: '/anime.html',
    redirect: to => ({ path: '/watch', query: to.query })
  },
  {
    path: '/watch.html',
    redirect: to => ({ path: '/watch', query: to.query })
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  }
});

export default router;
