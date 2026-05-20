import './style.css';
import { Dashboard } from './ui/Dashboard';

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  new Dashboard(app);
}
