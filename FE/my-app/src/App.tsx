import { Navigate, Route, Routes } from 'react-router'
import AuthProvider from './auth/AuthProvider'
import { GuestOnly, RequireAuth } from './auth/guards'
import CallsShell from './calls/CallsShell'
import LoginPage from './pages/LoginPage'
import MeetPage from './pages/MeetPage'
import RegisterPage from './pages/RegisterPage'
import HomeLayout from './pages/home/HomeLayout'
import MeetTab from './pages/home/MeetTab'
import VideoCallTab from './pages/home/VideoCallTab'
import NewSchedulePage from './pages/schedule/NewSchedulePage'
import ScheduleManagePage from './pages/schedule/ScheduleManagePage'
import SchedulePage from './pages/schedule/SchedulePage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<CallsShell />}>
            <Route path="/home" element={<HomeLayout />}>
              <Route index element={<Navigate to="meet" replace />} />
              <Route path="meet" element={<MeetTab />} />
              <Route path="video-call" element={<VideoCallTab />} />
            </Route>
            <Route path="/meet/:code" element={<MeetPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/schedule/new" element={<NewSchedulePage />} />
            <Route path="/schedule/:id" element={<ScheduleManagePage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AuthProvider>
  )
}
