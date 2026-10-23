import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import WatchView from '../views/WatchView.vue';
import AdminView from '../views/AdminView.vue';
import InviteView from '../views/InviteView.vue';
import AnimeDetailView from '../views/AnimeDetailView.vue';
import ScheduleView from '../views/ScheduleView.vue';
import LiveChartView from '../views/LiveChartView.vue';

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/schedule',
    name: 'schedule',
    component: ScheduleView
  },
  {
    path: '/jadwal',
    redirect: '/schedule'
  },
  {
    path: '/livechart',
    name: 'livechart',
    component: LiveChartView
  },
  {
    path: '/musim',
    redirect: '/livechart'
  },
  {
    path: '/anime',
    name: 'anime-detail',
    component: AnimeDetailView
  },
  {
    path: '/anime/:id',
    name: 'anime-detail-id',
    component: AnimeDetailView
  },
  {
    path: '/watch',
    name: 'watch',
    component: WatchView
  },
  {
    path: '/watch/:id',
    name: 'watch-id',
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
    path: '/anime.html',
    redirect: to => ({ path: '/anime', query: to.query })
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
