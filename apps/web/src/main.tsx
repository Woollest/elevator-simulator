import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ElevatorSimulator } from './ui/ElevatorSimulator';
import './styles/hall.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><ElevatorSimulator /></StrictMode>
);
