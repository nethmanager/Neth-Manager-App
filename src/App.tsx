import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Projects from './pages/Projects';
import Businesses from './pages/Businesses';
import Platforms from './pages/Platforms';
import EmailCenter from './pages/EmailCenter';
import DailyPlanner from './pages/DailyPlanner';
import Schedule from './pages/Schedule';
import Finance from './pages/Finance';
import AIAssistant from './pages/AIAssistant';
import Automations from './pages/Automations';
import Settings from './pages/Settings';
import ProjectPage from './pages/ProjectPage';
import Phonebook from './pages/Phonebook';
import PhonebookContactPage from './pages/PhonebookContactPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="businesses" element={<Businesses />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:projectId" element={<ProjectPage />} />
        <Route path="platforms" element={<Platforms />} />
        <Route path="emails" element={<EmailCenter />} />
        <Route path="phonebook" element={<Phonebook />} />
        <Route path="phonebook/:contactId" element={<PhonebookContactPage />} />
        <Route path="finance" element={<Finance />} />
        <Route path="planner" element={<DailyPlanner />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="assistant" element={<AIAssistant />} />
        <Route path="automations" element={<Automations />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
