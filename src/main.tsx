import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ElevatorSimulator } from './ui/ElevatorSimulator';
import '../style.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><ElevatorSimulator /></StrictMode>
);
