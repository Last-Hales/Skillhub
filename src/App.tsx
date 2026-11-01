import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, auth, ws } from '@appdeploy/client';
import type { AuthUser } from '@appdeploy/client';
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  Hammer,
  HeartHandshake,
  Hexagon,
  LogOut,
  Mail,
  Moon,
  Sun,
  ShieldAlert,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Bookmark,
  UserCheck,
  UserRound,
  Users,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { Bell } from 'lucide-react';

type Role = 'worker' | 'customer';
type Profile = {
  id?: string;
  userId?: string;
  role: Role;
  email: string;
  phone: string;
  fullName: string;
  address: string;
  country: string;
  state: string;
  skills: string;
  available: boolean;
  createdAt?: string;
  profileImage?: string;
  portfolio?: string;
  verificationStatus?: 'none' | 'pending' | 'verified';
};
type Application = {
  id: string;
  jobId: string;
  workerId: string;
  workerName: string;
  status: 'applied' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
  workerSkills?: string;
  workerState?: string;
  workerRating?: number;
  workerRatingCount?: number;
  workerImage?: string;
  workerVerified?: boolean;
};
type Opportunity = {
  id: string;
  customerId: string;
  customerName: string;
  workerId?: string | null;
  workerName?: string | null;
  skill: string;
  location: string;
  details: string;
  budget: string;
  status: 'open' | 'accepted' | 'completed' | 'cancelled';
  createdAt: string;
  applicants?: Application[];
  myApplicationStatus?: Application['status'];
  kind?: 'job' | 'team';
  teamSize?: number;
  workerIds?: string[];
  isOwner?: boolean;
  completionConfirmedBy?: string[];
};
type Worker = {
  id: string;
  role: Role;
  fullName: string;
  country: string;
  state: string;
  skills: string;
  available: boolean;
  rating: number;
  ratingCount: number;
  profileImage?: string;
  portfolio?: string;
  verified?: boolean;
};
type ChatMessage = {
  id: string;
  jobId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
};
type Bootstrap = {
  user: AuthUser;
  profile: Profile | null;
  workers: Worker[];
  opportunities: Opportunity[];
  myJobs: Opportunity[];
  notifications?: { id: string; title: string; body: string; createdAt: string; read: boolean }[];
  ratedJobIds?: string[];
  savedWorkerIds?: string[];
  portfolioPosts?: { id:string; ownerId:string; caption:string; imageUrl?:string; createdAt:string; likes:number; likedByMe:boolean; comments:{id:string;userId:string;userName:string;text:string;createdAt:string}[] }[];
  discoveryCursors?: { profiles: string | null; opportunities: string | null };
  myJobsCursors?: { opportunities: string | null; applications: string | null };
};

const emptyProfile: Profile = {
  role: 'customer',
  email: '',
  phone: '',
  fullName: '',
  address: '',
  country: 'Nigeria',
  state: '',
  skills: '',
  available: true,
};

const skillOptions = [
  'Tailoring', 'Fashion design', 'Hair styling', 'Barbing', 'Makeup', 'Nail technology',
  'Cooking', 'Baking', 'Catering', 'Cleaning', 'Laundry', 'Plumbing', 'Electrical work',
  'Carpentry', 'Welding', 'Painting', 'Tiling', 'Masonry', 'POP installation',
  'Phone repair', 'Computer repair', 'Graphic design', 'Photography', 'Videography',
  'Web development', 'Software development', 'CCTV installation', 'Solar installation',
  'AC repair', 'Generator repair', 'Auto mechanic', 'Driving', 'Event planning',
  'Perfume production', 'Furniture making', 'Pest control', 'Gardening', 'Other',
];
const nigeriaStates = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<Bootstrap | null>(null);
  const [profileForm, setProfileForm] = useState<Profile>(emptyProfile);
  const [profileMode, setProfileMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [activeTab, setActiveTab] = useState<
    'discover' | 'opportunities' | 'messages' | 'profile'
  >('discover');
  const [showOpportunityForm, setShowOpportunityForm] = useState(false);
  const [jobForm, setJobForm] = useState({
    skill: '',
    location: '',
    details: '',
    budget: '',
    kind: 'job' as 'job' | 'team',
    teamSize: 3,
  });
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [loadingDiscoveryPage, setLoadingDiscoveryPage] = useState(false);
  const [loadingMyJobsPage, setLoadingMyJobsPage] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Opportunity | null>(null);
  const selectedJobRef = useRef<Opportunity | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageNextToken, setMessageNextToken] = useState<string | null>(null);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const socketRef = useRef<ReturnType<typeof ws.connect> | null>(null);
  const subscribedJobRef = useRef<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [rating, setRating] = useState(5);
  const [authError, setAuthError] = useState('');
  const [darkMode, setDarkMode] = useState(() => window.localStorage.getItem('skillhub-theme') === 'dark');
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [reportText, setReportText] = useState('');
  const [showReportForm, setShowReportForm] = useState(false);
  const [customSkill, setCustomSkill] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [portfolioCaption, setPortfolioCaption] = useState('');
  const [portfolioComment, setPortfolioComment] = useState<Record<string,string>>({});
  const [portfolioBusy, setPortfolioBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await api.get('/api/bootstrap');
    const next = response.data as Bootstrap;
    setData(next);
    if (next.profile) setProfileForm(next.profile);
    else
      setProfileForm({
        ...emptyProfile,
        email: next.user.email ?? '',
        fullName: next.user.name ?? '',
      });
    setProfileMode(!next.profile);
  }, []);

  async function loadMoreDiscovery() {
    if (!data?.discoveryCursors || loadingDiscoveryPage) return;
    const cursors = data.discoveryCursors;
    if (!cursors.profiles && !cursors.opportunities) return;
    setLoadingDiscoveryPage(true);
    setErrorText('');
    try {
      const params = new URLSearchParams();
      if (cursors.profiles) params.set('profilesNextToken', cursors.profiles);
      if (cursors.opportunities) params.set('opportunitiesNextToken', cursors.opportunities);
      const response = await api.get('/api/discovery-page?' + params.toString());
      const page = response.data as Pick<Bootstrap, 'workers' | 'opportunities' | 'discoveryCursors'>;
      setData(current => {
        if (!current) return current;
        const mergeById = <T extends { id: string },>(existing: T[], incoming: T[]) => {
          const merged = new Map(existing.map(item => [item.id, item]));
          incoming.forEach(item => merged.set(item.id, item));
          return [...merged.values()];
        };
        return {
          ...current,
          workers: mergeById(current.workers, page.workers ?? []),
          opportunities: mergeById(current.opportunities, page.opportunities ?? []),
          discoveryCursors: page.discoveryCursors ?? current.discoveryCursors,
        };
      });
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Could not load more results.');
    } finally {
      setLoadingDiscoveryPage(false);
    }
  }

  async function loadMoreMyJobs() {
    if (!data?.myJobsCursors || loadingMyJobsPage) return;
    const cursors = data.myJobsCursors;
    if (!cursors.opportunities && !cursors.applications) return;
    setLoadingMyJobsPage(true);
    setErrorText('');
    try {
      const params = new URLSearchParams();
      if (cursors.opportunities) params.set('opportunitiesNextToken', cursors.opportunities);
      if (cursors.applications) params.set('applicationsNextToken', cursors.applications);
      const response = await api.get('/api/my-jobs-page?' + params.toString());
      const page = response.data as Pick<Bootstrap, 'myJobs' | 'myJobsCursors'>;
      setData(current => {
        if (!current) return current;
        const merged = new Map((current.myJobs ?? []).map(job => [job.id, job]));
        (page.myJobs ?? []).forEach(job => {
          const previous = merged.get(job.id);
          const applicants = new Map((previous?.applicants ?? []).map(applicant => [applicant.id, applicant]));
          (job.applicants ?? []).forEach(applicant => applicants.set(applicant.id, applicant));
          merged.set(job.id, {
            ...previous,
            ...job,
            ...(previous?.applicants || job.applicants ? { applicants: [...applicants.values()] } : {}),
          });
        });
        return { ...current, myJobs: [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), myJobsCursors: page.myJobsCursors ?? current.myJobsCursors };
      });
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Could not load more of your jobs.');
    } finally {
      setLoadingMyJobsPage(false);
    }
  }

  useEffect(() => {
    selectedJobRef.current = selectedJob;
  }, [selectedJob]);

  useEffect(() => {
    window.localStorage.setItem('skillhub-theme', darkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('skillhub-dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!user) return;
    const connection = ws.connect();
    socketRef.current = connection;
    connection.onMessage((event: any) => {
      if (event?.type !== 'entity.update' || event?.payload?.entity_type !== 'job-chat') return;
      const incoming = event.payload?.data?.message as ChatMessage | undefined;
      if (!incoming || event.payload?.entity_id !== selectedJobRef.current?.id) return;
      setMessages(current => current.some(item => item.id === incoming.id) ? current : [...current, incoming]);
    });
    return () => {
      connection.disconnect();
      socketRef.current = null;
      subscribedJobRef.current = null;
    };
  }, [user?.userId]);

  useEffect(() => {
    const connection = socketRef.current;
    const previous = subscribedJobRef.current;
    if (previous && previous !== selectedJob?.id && connection?.connectionId) {
      void api.post('/api/subscriptions/remove', { entity_type: 'job-chat', entity_id: previous, connection_id: connection.connectionId });
      subscribedJobRef.current = null;
    }
    if (selectedJob && connection) {
      void connection.ready.then(async () => {
        if (!connection.connectionId || subscribedJobRef.current === selectedJob.id) return;
        await api.post('/api/subscriptions', { entity_type: 'job-chat', entity_id: selectedJob.id, connection_id: connection.connectionId });
        subscribedJobRef.current = selectedJob.id;
      });
    }
  }, [selectedJob?.id, user?.userId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const restored = await auth.getUser();
        if (!alive) return;
        setUser(restored);
        if (restored) {
          try {
            const response = await api.get('/api/bootstrap');
            if (!alive) return;
            const next = response.data as Bootstrap;
            setData(next);
            setProfileForm(
              next.profile ?? {
                ...emptyProfile,
                email: next.user.email ?? '',
                fullName: next.user.name ?? '',
              }
            );
            setProfileMode(!next.profile);
          } catch (err) {
            if (alive)
              setErrorText(
                err instanceof Error ? err.message : 'Could not load SkillHub.'
              );
          }
        }
      } catch {
        if (alive)
          setAuthError('We could not restore your sign-in. Please try again.');
      } finally {
        if (alive) setAuthLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function signIn() {
    setAuthError('');
    try {
      await auth.signInWithRedirect();
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Sign-in could not start. Please try again.'
      );
    }
  }

  async function signOut() {
    await auth.signOut();
    setUser(null);
    setData(null);
    setSelectedJob(null);
    setMessages([]);
    setProfileMode(false);
  }

  function updateProfile<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfileForm(prev => ({ ...prev, [key]: value }));
  }

  function toggleSkill(skill: string) {
    const selected = profileForm.skills.split(',').map(item => item.trim()).filter(Boolean);
    const next = selected.includes(skill) ? selected.filter(item => item !== skill) : [...selected.filter(item => item !== 'Other'), skill];
    updateProfile('skills', next.join(', '));
  }

  async function uploadProfileImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setErrorText('Choose an image under 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.split(',')[1];
      try {
              const response = await api.post('/api/profile/avatar', { base64, contentType: file.type });
        updateProfile('profileImage', response.data.url);
        await refresh();
        setNotice('Profile picture updated.');
      } catch (err) {
        setErrorText(err instanceof Error ? err.message : 'Could not upload profile picture.');
      }
    };
    reader.readAsDataURL(file);
  }

  async function publishPortfolio(file?: File) {
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/) || file.size > 5 * 1024 * 1024) { setErrorText('Choose a JPG, PNG or WebP image under 5 MB.'); return; }
    setPortfolioBusy(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = String(reader.result || '').split(',')[1];
        await api.post('/api/portfolio', { base64, contentType: file.type, caption: portfolioCaption });
        setPortfolioCaption('');
        await refresh();
        setNotice('Portfolio photo published.');
      } catch (err) { setErrorText(err instanceof Error ? err.message : 'Could not publish portfolio photo.'); }
      finally { setPortfolioBusy(false); }
    };
    reader.onerror = () => { setPortfolioBusy(false); setErrorText('Could not read that image.'); };
    reader.readAsDataURL(file);
  }

  async function togglePortfolioLike(postId: string) {
    try { await api.post('/api/portfolio/' + encodeURIComponent(postId) + '/like'); await refresh(); }
    catch (err) { setErrorText(err instanceof Error ? err.message : 'Could not update like.'); }
  }

  async function addPortfolioComment(postId: string) {
    const text = (portfolioComment[postId] ?? '').trim();
    if (!text) return;
    try {
      await api.post('/api/portfolio/' + encodeURIComponent(postId) + '/comments', { text });
      setPortfolioComment(current => ({ ...current, [postId]: '' }));
      await refresh();
    } catch (err) { setErrorText(err instanceof Error ? err.message : 'Could not add comment.'); }
  }

  async function requestVerification() {
    setVerificationBusy(true);
    try {
      await api.post('/api/profile/verification');
      await refresh();
      setNotice('Verification request submitted. Our team will review it.');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Could not request verification.');
    } finally { setVerificationBusy(false); }
  }

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    if (!reportText.trim()) return;
    try {
      await api.post('/api/reports', { details: reportText.trim(), jobId: selectedJob?.id ?? '' });
      setReportText('');
      setShowReportForm(false);
      setNotice('Your report has been submitted for review.');
    } catch (err) { setErrorText(err instanceof Error ? err.message : 'Could not submit report.'); }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrorText('');
    setNotice('');
    try {
      const chosenSkills = profileForm.skills.split(',').map(item => item.trim()).filter(Boolean);
      const finalSkills = chosenSkills.includes('Other') ? [...chosenSkills.filter(item => item !== 'Other'), customSkill.trim()].filter(Boolean).join(', ') : profileForm.skills;
      const response = await api.post('/api/profile', { ...profileForm, skills: finalSkills });
      const next = response.data as { profile: Profile };
      setProfileForm(next.profile);
      setProfileMode(false);
      await refresh();
      setNotice('Your SkillHub profile is saved.');
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : 'Could not save your profile.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleAvailability() {
    if (!data?.profile) return;
    const next = { ...data.profile, available: !data.profile.available };
    setBusy(true);
    setErrorText('');
    try {
      await api.post('/api/profile', next);
      await refresh();
      setNotice(
        next.available
          ? 'You are now visible as available.'
          : 'You are now marked unavailable.'
      );
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : 'Could not update availability.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function createOpportunity(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrorText('');
    setNotice('');
    try {
      await api.post('/api/opportunities', jobForm);
      setJobForm({ skill: '', location: '', details: '', budget: '', kind: 'job', teamSize: 3 });
      setShowOpportunityForm(false);
      await refresh();
      setActiveTab('opportunities');
      setNotice(
        'Opportunity posted. Available workers with matching skills and locations can find it.'
      );
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : 'Could not post the opportunity.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function applyForOpportunity(job: Opportunity) {
    setBusy(true);
    setErrorText('');
    try {
      if (job.kind === 'team') {
        await api.post('/api/opportunities/' + encodeURIComponent(job.id) + '/apply');
        await refresh();
        setNotice('Application sent. The team organiser will choose from the applicants.');
      } else {
        await api.post('/api/opportunities/' + encodeURIComponent(job.id) + '/accept');
        await refresh();
        setNotice('You accepted this opportunity. The customer can now chat with you in SkillHub.');
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Could not apply for this job.');
    } finally {
      setBusy(false);
    }
  }

  async function chooseApplicant(job: Opportunity, workerId: string) {
    setBusy(true);
    setErrorText('');
    try {
      await api.post('/api/opportunities/' + encodeURIComponent(job.id) + '/choose', { workerId });
      await refresh();
      setNotice(job.kind === 'team' ? 'Worker added to your team. Keep selecting applicants until your team is full.' : 'Worker selected. Other applicants have been marked declined. You can now chat in SkillHub.');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Could not select this worker.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteOpportunity(job: Opportunity) {
    if (!window.confirm('Remove this job from active opportunities? It will remain in your history as cancelled.')) return;
    setBusy(true);
    setErrorText('');
    try {
      await api.delete('/api/opportunities/' + encodeURIComponent(job.id));
      await refresh();
      setNotice('Job cancelled and moved to your history.');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Could not cancel this job.');
    } finally {
      setBusy(false);
    }
  }

  async function completeJob(job: Opportunity) {
    setBusy(true);
    setErrorText('');
    try {
      const response = await api.post('/api/opportunities/' + encodeURIComponent(job.id) + '/complete');
      await refresh();
      setNotice(response.data.completed ? 'Completion confirmed by everyone. You can now leave a rating.' : 'Your confirmation is recorded. The other party must also confirm before the job is marked complete.');
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : 'Could not complete this job.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function openChat(job: Opportunity) {
    if ((job.status === 'open' && !(job.kind === 'team' && (job.workerIds?.length ?? 0) > 0)) || job.status === 'cancelled' || (!job.workerId && job.kind !== 'team')) {
      setNotice('Chat opens after a customer selects a worker.');
      return;
    }
    setSelectedJob(job);
    setActiveTab('messages');
    setErrorText('');
    try {
      const response = await api.get('/api/messages/' + encodeURIComponent(job.id));
      const page = response.data as { messages: ChatMessage[]; nextToken?: string | null };
      setMessages(page.messages);
      setMessageNextToken(page.nextToken ?? null);
      await api.post('/api/messages/' + encodeURIComponent(job.id) + '/read');
    } catch (err) {
      setMessages([]);
      setErrorText(
        err instanceof Error ? err.message : 'Could not open messages.'
      );
    }
  }

  async function reloadMessages() {
    if (!selectedJob) return;
    try {
      const response = await api.get('/api/messages/' + encodeURIComponent(selectedJob.id));
      const page = response.data as { messages: ChatMessage[]; nextToken?: string | null };
      setMessages(page.messages);
      setMessageNextToken(page.nextToken ?? null);
      await api.post('/api/messages/' + encodeURIComponent(selectedJob.id) + '/read', {
        messageIds: page.messages.map(message => message.id),
      });
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : 'Could not refresh messages.'
      );
    }
  }

  async function loadOlderMessages() {
    if (!selectedJob || !messageNextToken || loadingOlderMessages) return;
    setLoadingOlderMessages(true);
    try {
      const response = await api.get(
        '/api/messages/' + encodeURIComponent(selectedJob.id) + '?nextToken=' + encodeURIComponent(messageNextToken)
      );
      const page = response.data as { messages: ChatMessage[]; nextToken?: string | null };
      setMessages(current => [...page.messages, ...current.filter(item => !page.messages.some(older => older.id === item.id))]);
      setMessageNextToken(page.nextToken ?? null);
      await api.post('/api/messages/' + encodeURIComponent(selectedJob.id) + '/read', {
        messageIds: page.messages.map(message => message.id),
      });
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Could not load older messages.');
    } finally {
      setLoadingOlderMessages(false);
    }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedJob || !messageText.trim()) return;
    setBusy(true);
    setErrorText('');
    try {
      await api.post('/api/messages', {
        jobId: selectedJob.id,
        text: messageText.trim(),
      });
      setMessageText('');
      await reloadMessages();
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : 'Message could not be sent.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitRating(job: Opportunity, targetId: string) {
    setBusy(true);
    setErrorText('');
    try {
      await api.post('/api/ratings', {
        jobId: job.id,
        targetId,
        score: rating,
      });
      await refresh();
      setNotice('Thanks for rating your SkillHub experience.');
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : 'Could not submit rating.'
      );
    } finally {
      setBusy(false);
    }
  }

  const workers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const a = area.trim().toLowerCase();
    return (data?.workers ?? [])
      .filter(worker => {
        const skillMatch =
          !q ||
          worker.skills.toLowerCase().includes(q) ||
          worker.fullName.toLowerCase().includes(q);
        const areaMatch =
          !a ||
          worker.state.toLowerCase().includes(a) ||
          worker.country.toLowerCase().includes(a);
        const savedMatch = !showSavedOnly || (data?.savedWorkerIds ?? []).includes(worker.id);
        return skillMatch && areaMatch && savedMatch;
      })
      .sort(
        (left, right) =>
          Number(right.available) - Number(left.available) ||
          right.rating - left.rating
      );
  }, [data?.workers, data?.savedWorkerIds, search, area, showSavedOnly]);

  const openJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const a = area.trim().toLowerCase();
    return (data?.opportunities ?? [])
      .filter(
        job =>
          (!q ||
            job.skill.toLowerCase().includes(q) ||
            job.details.toLowerCase().includes(q)) &&
          (!a || job.location.toLowerCase().includes(a))
      )
      .sort(
        (left, right) =>
          Number(right.status === 'open') - Number(left.status === 'open')
      );
  }, [data?.opportunities, search, area]);

  if (authLoading) {
    return (
      <main className="loading-screen">
        <div className="brand-mark">
          <Wrench size={20} />
        </div>
        <p>Getting SkillHub ready…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="landing">
        <nav className="top-nav landing-nav">
          <a className="brand" href="#top">
            <span className="brand-mark logo-image-mark">
              <img src="/resources/skillhub-logo.jpg" alt="SkillHub logo" />
            </span>
            <span>
              Skill<span>Hub</span>
            </span>
          </a>
          <button className="button button-outline" onClick={signIn}>
            Log in <ArrowRight size={16} />
          </button>
        </nav>
        <section className="landing-hero" id="top">
          <div className="landing-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" /> YOUR SKILL. SOMEONE'S SOLUTION.
            </div>
            <h1>
              Good work
              <br />
              finds <span>its people.</span>
            </h1>
            <p className="landing-lede">
              Find trusted local professionals, or let nearby customers discover
              what you do best. SkillHub brings real skills and real
              opportunities together.
            </p>
            <button
              className="button button-primary button-large"
              onClick={signIn}
            >
              Join SkillHub <ArrowRight size={17} />
            </button>
            {authError && <p className="error-text">{authError}</p>}
            <div className="trust-line">
              <ShieldCheck size={17} /> Profiles, job history and ratings help
              build trust.
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Illustration of a local skills marketplace"
          >
            <div className="art-orbit orbit-a" />
            <div className="art-orbit orbit-b" />
            <div className="art-center">
              <HeartHandshake size={53} strokeWidth={1.4} />
            </div>
            <div className="skill-bubble bubble-one">
              <span className="bubble-icon coral">
                <Wrench size={18} />
              </span>
              <span>
                <b>Phone repair</b>
                <small>Skill meets need</small>
              </span>
              <BadgeCheck size={17} className="verified" />
            </div>
            <div className="skill-bubble bubble-two">
              <span className="bubble-icon blue">
                <Sparkles size={18} />
              </span>
              <span>
                <b>Fashion & tailoring</b>
                <small>Made with care</small>
              </span>
              <BadgeCheck size={17} className="verified" />
            </div>
            <div className="skill-bubble bubble-three">
              <span className="bubble-icon green">
                <Hammer size={18} />
              </span>
              <span>
                <b>Home services</b>
                <small>Local professionals</small>
              </span>
              <BadgeCheck size={17} className="verified" />
            </div>
            <div className="art-caption">
              <span className="caption-pulse" /> Connecting communities, one job
              at a time
            </div>
          </div>
        </section>
        <section className="feature-strip">
          <div>
            <span className="feature-icon">
              <Search size={19} />
            </span>
            <b>Find the right skill</b>
            <p>Search by service and location.</p>
          </div>
          <div>
            <span className="feature-icon">
              <ShieldCheck size={19} />
            </span>
            <b>Build trust</b>
            <p>Use profiles, messages and ratings.</p>
          </div>
          <div>
            <span className="feature-icon">
              <MessageCircle size={19} />
            </span>
            <b>Talk in one place</b>
            <p>Keep job conversations on SkillHub.</p>
          </div>
        </section>
        <footer className="landing-footer">
          <span>
            SkillHub <span className="footer-dot">●</span> Built for skills,
            powered by people.
          </span>
          <span>Support: skill.hub.gtt@gmail.com</span>
        </footer>
      </main>
    );
  }

  if (profileMode || !data?.profile) {
    return (
      <main className="onboarding-shell">
        <div className="onboarding-card">
          <a className="brand" href="#top">
            <span className="brand-mark logo-image-mark">
              <img src="/resources/skillhub-logo.jpg" alt="SkillHub logo" />
            </span>
            <span>
              Skill<span>Hub</span>
            </span>
          </a>
          <div className="onboarding-heading">
            <p className="eyebrow">LET'S GET YOU STARTED</p>
            <h1>Welcome to SkillHub.</h1>
            <p>Set up your profile so the right people can find you.</p>
          </div>
          <form className="profile-form" onSubmit={saveProfile}>
            <div className="role-picker">
              <button
                type="button"
                className={
                  profileForm.role === 'customer'
                    ? 'role-option selected'
                    : 'role-option'
                }
                onClick={() => updateProfile('role', 'customer')}
              >
                <UserRound size={20} />
                <b>I need a service</b>
                <small>Find and hire skilled people</small>
              </button>
              <button
                type="button"
                className={
                  profileForm.role === 'worker'
                    ? 'role-option selected'
                    : 'role-option'
                }
                onClick={() => updateProfile('role', 'worker')}
              >
                <Wrench size={20} />
                <b>I offer a skill</b>
                <small>Get discovered and find jobs</small>
              </button>
            </div>
            <div className="form-grid">
              <label>
                Full name
                <input
                  required
                  value={profileForm.fullName}
                  onChange={e => updateProfile('fullName', e.target.value)}
                  placeholder="Your full name"
                />
              </label>
              <label>
                Email address
                <input
                  required
                  type="email"
                  value={profileForm.email}
                  onChange={e => updateProfile('email', e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Phone number
                <input
                  required
                  type="tel"
                  value={profileForm.phone}
                  onChange={e => updateProfile('phone', e.target.value)}
                  placeholder="+234…"
                />
              </label>
              <label>
                Country
                <input
                  required
                  value={profileForm.country}
                  onChange={e => updateProfile('country', e.target.value)}
                  placeholder="Nigeria"
                />
              </label>
              <label>
                State
                <select required value={profileForm.state} onChange={e => updateProfile('state', e.target.value)}>
                  <option value="">Choose your state</option>
                  {nigeriaStates.map(state => <option key={state} value={state}>{state}</option>)}
                </select>
              </label>
              <label>
                Address / area
                <input
                  required
                  value={profileForm.address}
                  onChange={e => updateProfile('address', e.target.value)}
                  placeholder="Town or neighbourhood"
                />
              </label>
              {profileForm.role === 'worker' && (
                <div className="full-field skill-picker">
                  <b>Skills and services <span className="required-star">*</span></b>
                  <small>Select every skill you offer. Choose Other if yours is not listed.</small>
                  <div className="skill-options">
                    {skillOptions.map(skill => {
                      const selected = profileForm.skills.split(',').map(item => item.trim()).includes(skill);
                      return <button key={skill} type="button" className={selected ? 'skill-option selected' : 'skill-option'} onClick={() => toggleSkill(skill)}>{selected ? '✓ ' : '+ '}{skill}</button>;
                    })}
                  </div>
                  {profileForm.skills.split(',').map(item => item.trim()).includes('Other') && <input required placeholder="Enter your skill or service" value={customSkill} onChange={e => setCustomSkill(e.target.value)} />}
                  {!profileForm.skills && <input required tabIndex={-1} aria-hidden="true" className="skill-required-proxy" value="" readOnly />}
                </div>
              )}
            </div>
            {errorText && <p className="error-text">{errorText}</p>}
            <button
              className="button button-primary button-full"
              type="submit"
              disabled={busy}
            >
              {busy ? 'Saving profile…' : 'Save profile and continue'}{' '}
              <ArrowRight size={16} />
            </button>
            <p className="privacy-note">
              <ShieldCheck size={14} /> Your contact details are not shown on
              public worker cards.
            </p>
          </form>
        </div>
      </main>
    );
  }

  const profile = data.profile;
  const myJobs = data.myJobs ?? [];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand side-brand" href="#home">
          <span className="brand-mark logo-image-mark">
            <img src="/resources/skillhub-logo.jpg" alt="SkillHub logo" />
          </span>
          <span>
            Skill<span>Hub</span>
          </span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <button
          className={
            activeTab === 'discover' ? 'side-link active' : 'side-link'
          }
          onClick={() => setActiveTab('discover')}
        >
          <Compass size={18} /> Discover
        </button>
        <button
          className={
            activeTab === 'opportunities' ? 'side-link active' : 'side-link'
          }
          onClick={() => setActiveTab('opportunities')}
        >
          <BriefcaseBusiness size={18} /> Opportunities{' '}
          <span className="side-count">{openJobs.length}</span>
        </button>
        <button
          className={
            activeTab === 'messages' ? 'side-link active' : 'side-link'
          }
          onClick={() => setActiveTab('messages')}
        >
          <MessageCircle size={18} /> Messages
        </button>
        <button
          className={activeTab === 'profile' ? 'side-link active' : 'side-link'}
          onClick={() => {
            setActiveTab('profile');
            setProfileForm(profile);
          }}
        >
          <UserRound size={18} /> Profile
        </button>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <CircleHelp size={18} />
            <b>Need a hand?</b>
            <p>Contact the SkillHub team.</p>
            <a href="mailto:skill.hub.gtt@gmail.com">Email support ↗</a>
            <a
              href="https://wa.me/2349015210112"
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp support ↗
            </a>
          </div>
          <div className="mini-profile">
            <span className="avatar profile-avatar-wrap">
              {profile.profileImage ? <img src={profile.profileImage} alt="Profile" onError={event => { event.currentTarget.style.display = 'none'; }} /> : profile.fullName.slice(0, 1).toUpperCase()}
            </span>
            <span className="mini-profile-copy">
              <b>{profile.fullName}</b>
              <small>
                {profile.role === 'worker'
                  ? 'Skilled professional'
                  : 'Customer'}
              </small>
            </span>
            <button className="icon-button" title="Log out" onClick={signOut}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="dashboard-header">
          <div>
            <p className="breadcrumb">
              WORKSPACE <span>/</span> {activeTab.toUpperCase()}
            </p>
            <h1>
              {activeTab === 'discover'
                ? 'Discover your next connection'
                : activeTab === 'opportunities'
                  ? 'Job opportunities'
                  : activeTab === 'messages'
                    ? 'Your conversations'
                    : 'Profile'}
            </h1>
          </div>
          <div className="header-actions">
            <button className="icon-button theme-toggle" title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDarkMode(value => !value)}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
            <span className="location-chip">
              <MapPin size={15} /> {profile.state || profile.country}
            </span>
            <button className="icon-button notification-toggle" title="Notifications" onClick={() => setShowNotifications(value => !value)}><Bell size={18} />{(data.notifications ?? []).filter(item => !item.read).length > 0 && <i>{(data.notifications ?? []).filter(item => !item.read).length}</i>}</button>
            <span className="user-avatar profile-avatar-wrap">
              {profile.profileImage ? <img src={profile.profileImage} alt="Profile" onError={event => { event.currentTarget.style.display = 'none'; }} /> : profile.fullName.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>

        {showNotifications && <div className="notifications-panel"><b>Notifications</b>{(data.notifications ?? []).length ? (data.notifications ?? []).map(item => <div className="notification-item" key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div>) : <p className="empty-mini">You're all caught up. Job updates will appear here.</p>}</div>}

        {errorText && (
          <div className="alert alert-error">
            <X size={16} /> {errorText}
            <button onClick={() => setErrorText('')}>
              <X size={14} />
            </button>
          </div>
        )}
        {notice && (
          <div className="alert alert-success">
            <Check size={16} /> {notice}
            <button onClick={() => setNotice('')}>
              <X size={14} />
            </button>
          </div>
        )}

        {activeTab === 'discover' && (
          <>
            <section className="welcome-banner">
              <div className="welcome-copy">
                <div className="welcome-pill">
                  <Wrench size={13} /> YOUR SKILLHUB SPACE
                </div>
                <h2>
                  {profile.role === 'worker'
                    ? 'Your skills deserve to be found.'
                    : 'What do you need help with?'}
                </h2>
                <p>
                  {profile.role === 'worker'
                    ? 'Stay available, explore new jobs, and build a reputation one good job at a time.'
                    : 'Find skilled people around your area, or post an opportunity and let them come to you.'}
                </p>
                <button className="button button-primary" onClick={() => { setJobForm(prev => ({ ...prev, kind: profile.role === 'worker' ? 'team' : 'job' })); setShowOpportunityForm(true); }}>
                  {profile.role === 'worker' ? 'Create a Team-Up' : 'Create an opportunity'} <ArrowRight size={16} />
                </button>
              </div>
              <div className="welcome-art">
                <div className="welcome-art-circle">
                  <HeartHandshake size={48} />
                </div>
                <span className="welcome-spark spark-one">✦</span>
                <span className="welcome-spark spark-two">✧</span>
                <span className="welcome-tag">Skills connect us</span>
              </div>
            </section>

            {false && profile.role === 'worker' && (
              <section className="availability-banner">
                <div className="availability-icon">
                  <Clock3 size={20} />
                </div>
                <div className="availability-copy">
                  <b>
                    You are{' '}
                    {profile.available
                      ? 'visible to customers'
                      : 'currently unavailable'}
                  </b>
                  <p>
                    {profile.available
                      ? 'Customers can discover your profile and send you job opportunities.'
                      : 'Your profile is hidden from the available worker results until you switch back on.'}
                  </p>
                </div>
                <button
                  className={profile.available ? 'toggle on' : 'toggle'}
                  onClick={toggleAvailability}
                  disabled={busy}
                  aria-label="Toggle availability"
                >
                  <span />
                </button>
              </section>
            )}

            <section className="search-section">
              <div className="section-title-row">
                <div>
                  <p className="eyebrow">SEARCH SKILLS, NOT JUST NAMES</p>
                  <h2>
                    {profile.role === 'worker'
                      ? 'Find jobs that fit your skills'
                      : 'Find the right professional'}
                  </h2>
                </div>
                <span className="result-count">
                  {profile.role === 'worker' ? openJobs.length : workers.length}{' '}
                  results
                </span>
                {profile.role === 'customer' && <button className="button button-outline button-small" onClick={() => setShowSavedOnly(value => !value)}>{showSavedOnly ? 'All workers' : 'Saved workers'} ({data.savedWorkerIds?.length ?? 0})</button>}
              </div>
              <div className="search-bar">
                <Search size={18} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={profile.role === 'worker' ? 'Search jobs by skill or description' : 'Search worker name or skill'}
                />
                <span className="search-divider" />
                <MapPin size={17} />
                <input
                  className="area-input"
                  value={area}
                  onChange={e => setArea(e.target.value)}
                  placeholder="State or area"
                />
                <button
                  className="search-clear"
                  onClick={() => {
                    setSearch('');
                    setArea('');
                  }}
                  title="Clear search"
                >
                  <X size={16} />
                </button>
              </div>
            </section>

            {profile.role === 'customer' ? (
              <section className="cards-grid">
                {workers.map(worker => (
                  <article className="worker-card" key={worker.id}>
                    <div className="worker-card-top">
                      <span className="worker-avatar">
                        {worker.profileImage ? <img src={worker.profileImage} alt={worker.fullName} /> : worker.fullName.slice(0, 1).toUpperCase()}
                      </span>
                      <span
                        className={
                          worker.available
                            ? 'availability-label'
                            : 'availability-label unavailable'
                        }
                      >
                        <i />
                        {worker.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                    <div className="worker-card-name-row"><h3>{worker.fullName}</h3><button className="icon-button save-worker" title={(data.savedWorkerIds ?? []).includes(worker.id) ? 'Remove saved worker' : 'Save worker'} onClick={async () => { try { if ((data.savedWorkerIds ?? []).includes(worker.id)) await api.delete('/api/saved-workers/' + encodeURIComponent(worker.id)); else await api.post('/api/saved-workers', { workerId: worker.id }); await refresh(); } catch (err) { setErrorText(err instanceof Error ? err.message : 'Could not update saved workers.'); } }}><Bookmark size={16} fill={(data.savedWorkerIds ?? []).includes(worker.id) ? 'currentColor' : 'none'} /></button></div>
                    <p className="worker-skills">
                      {worker.skills || 'Skilled professional'}
                    </p>
                    <p className="worker-location">
                      <MapPin size={14} /> {worker.state}, {worker.country}
                    </p>
                    {worker.portfolio && <a className="portfolio-link" href={worker.portfolio} target="_blank" rel="noreferrer">View work portfolio ↗</a>}
                    <div className="worker-card-footer">
                      <span className="rating-line">
                        {worker.verified && <BadgeCheck size={14} className="verified" title="Verified profile" />}
                        <Star size={14} fill="currentColor" />{' '}
                        {worker.rating ? worker.rating.toFixed(1) : 'New'}{' '}
                        <small>({worker.ratingCount} ratings)</small>
                      </span>
                      <button
                        className="text-button"
                        onClick={() => {
                          setJobForm(prev => ({
                            ...prev,
                            skill: worker.skills.split(',')[0]?.trim() ?? '',
                            location: profile.state,
                          }));
                          setShowOpportunityForm(true);
                        }}
                      >
                        Request service <ArrowRight size={15} />
                      </button>
                    </div>
                  </article>
                ))}
                {workers.length === 0 && (
                  <div className="empty-state">
                    <Users size={28} />
                    <h3>No matching professionals yet</h3>
                    <p>
                      Try a different skill or location, or create an
                      opportunity so available workers can find you.
                    </p>
                    <button
                      className="button button-primary"
                      onClick={() => setShowOpportunityForm(true)}
                    >
                      Post an opportunity
                    </button>
                  </div>
                )}
              </section>
            ) : (
              <section className="jobs-list">
                {openJobs
                  .filter(job => job.status === 'open')
                  .map(job => (
                    <article className="job-card" key={job.id}>
                      <div className="job-icon">
                        <BriefcaseBusiness size={20} />
                      </div>
                      <div className="job-main">
                        <div className="job-title-line">
                          <h3>{job.skill}</h3>
                          <span className="status-badge open">{job.kind === 'team' ? 'Team-Up' : 'Open'}</span>
                        </div>
                        <p>
                          {job.details ||
                            'Customer is looking for this service.'}
                        </p>
                        <div className="job-meta">
                          <span>
                            <MapPin size={13} /> {job.location}
                          </span>
                          <span>
                            <UserRound size={13} /> {job.customerName}
                          </span>
                          {job.kind === 'team' && <span><Users size={13} /> Team needs {job.teamSize ?? 2} workers · {job.workerIds?.length ?? 0} joined</span>}
                          {job.budget && (
                            <span className="budget">Budget: {job.budget}</span>
                          )}
                        </div>
                      </div>
                      <button
                        className="button button-primary"
                        disabled={busy || !profile.available}
                        onClick={() => applyForOpportunity(job)}
                      >
                        {profile.available
                          ? job.kind === 'team' ? 'Apply to join team' : 'Accept job'
                          : 'Set available to apply'}{' '}
                        <ArrowRight size={15} />
                      </button>
                    </article>
                  ))}
                {openJobs.filter(job => job.status === 'open').length === 0 && (
                  <div className="empty-state">
                    <BriefcaseBusiness size={28} />
                    <h3>No open opportunities match yet</h3>
                    <p>
                      Try clearing your search or check again later. New
                      opportunities appear here when customers post them.
                    </p>
                    <button className="button button-outline" onClick={refresh}>
                      Refresh opportunities
                    </button>
                  </div>
                )}
              </section>
            )}
            {((profile.role === 'customer' && data.discoveryCursors?.profiles) || (profile.role === 'worker' && data.discoveryCursors?.opportunities)) && (
              <div className="load-more-row">
                <button className="button button-outline" onClick={loadMoreDiscovery} disabled={loadingDiscoveryPage}>
                  {loadingDiscoveryPage ? 'Loading…' : 'Load more results'}
                </button>
              </div>
            )}
            <div className="trust-note">
              <ShieldCheck size={17} />
              <span>
                <b>Build trust with every job.</b> Keep conversations in
                SkillHub and leave a rating when the work is done.
              </span>
            </div>
          </>
        )}

        {activeTab === 'opportunities' && (
          <section className="content-section">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">JOBS AND REQUESTS</p>
                <h2>
                  {profile.role === 'customer'
                    ? 'Your requests and job progress'
                    : 'Available and accepted work'}
                </h2>
              </div>
              <button className="button button-primary" onClick={() => { setJobForm(prev => ({ ...prev, kind: profile.role === 'worker' ? 'team' : 'job' })); setShowOpportunityForm(true); }}>
                {profile.role === 'worker' ? '+ Create Team-Up' : '+ Create opportunity'}
              </button>
            </div>
            <div className="jobs-list">
              {myJobs.map(job => (
                <article className="job-card" key={job.id}>
                  <div className="job-icon">
                    <BriefcaseBusiness size={20} />
                  </div>
                  <div className="job-main">
                    <div className="job-title-line">
                      <h3>{job.skill}</h3>
                      <span className={'status-badge ' + job.status}>
                        {job.status === 'completed' ? 'Completed' : job.status === 'accepted' ? 'In progress' : job.status === 'cancelled' ? 'Cancelled' : job.kind === 'team' ? 'Team-Up' : profile.role === 'worker' && job.myApplicationStatus ? job.myApplicationStatus[0].toUpperCase() + job.myApplicationStatus.slice(1) : 'Open'}
                      </span>
                    </div>
                    <p>{job.details || 'Service request'}</p>
                    <div className="job-meta">
                      <span>
                        <MapPin size={13} /> {job.location}
                      </span>
                      <span>
                        {job.isOwner ? 'Posted by you' : profile.role === 'customer' ? 'Worker: ' + (job.workerName || 'Waiting for acceptance') : 'Posted by: ' + job.customerName}
                      </span>
                      {job.kind === 'team' && <span><Users size={13} /> {job.workerIds?.length ?? 0}/{job.teamSize ?? 2} team members</span>}
                      <span><Clock3 size={13} /> Posted {new Date(job.createdAt).toLocaleDateString()}</span>
                      {job.budget && (
                        <span className="budget">{job.budget}</span>
                      )}
                    </div>
                  </div>
                  <div className="job-actions">
                    {((job.status !== 'open' && job.status !== 'cancelled' && job.workerId) || (job.kind === 'team' && (job.workerIds?.length ?? 0) > 0)) && (
                      <button className="button button-outline" onClick={() => openChat(job)}>
                        <MessageCircle size={15} /> Chat
                      </button>
                    )}
                    {job.isOwner && job.status === 'open' && (
                      <button className="button button-outline" disabled={busy} onClick={() => deleteOpportunity(job)}>
                        <Trash2 size={15} /> Delete job
                      </button>
                    )}
                    {job.status === 'accepted' && !(job.completionConfirmedBy ?? []).includes(user.userId) && (
                      <button
                        className="button button-primary"
                        onClick={() => completeJob(job)}
                        disabled={busy}
                      >
                        Confirm completion
                      </button>
                    )}
                    {job.status === 'completed' && !(data.ratedJobIds ?? []).includes(job.id) && (
                      <button className="button button-outline" onClick={() => { setSelectedJob(job); setRating(5); }}>Rate job <Star size={14} /></button>
                    )}
                    {job.status === 'accepted' && (job.completionConfirmedBy ?? []).includes(user.userId) && <span className="completion-waiting">Waiting for other party to confirm</span>}
                    {(job.isOwner || job.workerId === user.userId || (job.workerIds ?? []).includes(user.userId)) && <button className="button button-outline button-small" onClick={() => { setSelectedJob(job); setShowReportForm(true); }}><ShieldAlert size={14} /> Report job</button>}
                  </div>
                  {job.isOwner && (job.applicants?.length ?? 0) > 0 && (
                    <div className="applicants-panel">
                      <div className="applicants-heading"><UserCheck size={16} /><b>Applicants ({job.applicants?.length ?? 0})</b></div>
                      {(job.applicants ?? []).map(applicant => (
                        <div className="applicant-row" key={applicant.id}>
                          <span className="applicant-avatar">{applicant.workerImage ? <img src={applicant.workerImage} alt={applicant.workerName} /> : applicant.workerName.slice(0, 1).toUpperCase()}</span>
                          <span className="applicant-copy"><b>{applicant.workerName} {applicant.workerVerified && <BadgeCheck size={13} className="verified" />}</b><small>{applicant.workerSkills || 'Skilled professional'} · {applicant.workerState || 'Location not listed'}</small><small>{applicant.workerRating ? '★ ' + applicant.workerRating.toFixed(1) : 'New profile'} ({applicant.workerRatingCount ?? 0} ratings) · {applicant.status === 'applied' ? 'Awaiting your decision' : applicant.status}</small></span>
                          {job.status === 'open' && applicant.status === 'applied' && <button className="button button-primary button-small" disabled={busy} onClick={() => chooseApplicant(job, applicant.workerId)}>{job.kind === 'team' ? 'Add to team' : 'Choose worker'}</button>}
                        </div>
                      ))}
                      {(job.applicants ?? []).length === 0 && <p className="empty-mini">No applications yet. Workers will appear here after they apply.</p>}
                    </div>
                  )}
                  {job.status === 'completed' && selectedJob?.id === job.id && !(data.ratedJobIds ?? []).includes(job.id) && (
                    <div className="rating-panel">
                      <b>How was your experience?</b>
                      <div className="rating-stars">
                        {[1, 2, 3, 4, 5].map(value => (
                          <button
                            key={value}
                            className={
                              rating >= value
                                ? 'star-button selected'
                                : 'star-button'
                            }
                            onClick={() => setRating(value)}
                            aria-label={'Rate ' + value + ' stars'}
                          >
                            <Star size={22} fill="currentColor" />
                          </button>
                        ))}
                      </div>
                      <button
                        className="button button-primary"
                        onClick={() =>
                          submitRating(
                            job,
                            job.isOwner && job.kind === 'team'
                              ? (job.workerIds?.[0] ?? job.workerId ?? '')
                              : profile.role === 'customer'
                                ? (job.workerId ?? '')
                                : job.customerId
                          )
                        }
                        disabled={
                          busy || (profile.role === 'customer' && !job.workerId)
                        }
                      >
                        Submit rating
                      </button>
                    </div>
                  )}
                </article>
              ))}
              {myJobs.length === 0 && (
                <div className="empty-state">
                  <BriefcaseBusiness size={28} />
                  <h3>No jobs here yet</h3>
                  <p>
                    {profile.role === 'customer'
                      ? 'Create your first opportunity and find someone who can help.'
                      : 'Open opportunities will appear in Discover. Accept a job to start your first conversation.'}
                  </p>
                  {profile.role === 'customer' && (
                    <button
                      className="button button-primary"
                      onClick={() => setShowOpportunityForm(true)}
                    >
                      Create an opportunity
                    </button>
                  )}
                </div>
              )}
            </div>
            {data.myJobsCursors && (data.myJobsCursors.opportunities || data.myJobsCursors.applications) && (
              <div className="load-more-row">
                <button className="button button-outline" onClick={loadMoreMyJobs} disabled={loadingMyJobsPage}>
                  {loadingMyJobsPage ? 'Loading…' : 'Load more of your jobs'}
                </button>
              </div>
            )}
          </section>
        )}

        {activeTab === 'messages' && (
          <section className="content-section chat-layout">
            <div className="chat-sidebar">
              <div className="chat-list-header">
                <h2>Job chats</h2>
                <button
                  className="icon-button"
                  onClick={refresh}
                  title="Refresh"
                >
                  <Clock3 size={16} />
                </button>
              </div>
              {myJobs
                .filter(job => job.status !== 'open')
                .map(job => (
                  <button
                    className={
                      selectedJob?.id === job.id
                        ? 'chat-job selected'
                        : 'chat-job'
                    }
                    key={job.id}
                    onClick={() => openChat(job)}
                  >
                    <span className="chat-avatar">
                      {(profile.role === 'customer'
                        ? job.workerName
                        : job.customerName
                      )
                        ?.slice(0, 1)
                        .toUpperCase() || 'S'}
                    </span>
                    <span>
                      <b>{job.skill}</b>
                      <small>
                        {profile.role === 'customer'
                          ? job.workerName || 'Worker'
                          : job.customerName}
                      </small>
                    </span>
                    <ChevronDown size={14} />
                  </button>
                ))}
              {myJobs.filter(job => job.status !== 'open').length === 0 && (
                <p className="empty-mini">
                  Accepted jobs appear here so you can message the other person.
                </p>
              )}
            </div>
            <div className="chat-window">
              {selectedJob ? (
                <>
                  <div className="chat-top">
                    <div>
                      <b>{selectedJob.skill}</b>
                      <small>
                        <MapPin size={12} /> {selectedJob.location}
                      </small>
                    </div>
                    <span className="live-status"><i /> Live chat</span>
                  </div>
                  <div className="messages-area">
                    {messageNextToken && (
                      <button type="button" className="secondary-button" onClick={loadOlderMessages} disabled={loadingOlderMessages}>
                        {loadingOlderMessages ? 'Loading…' : 'Load older messages'}
                      </button>
                    )}
                    {messages.map(message => (
                      <div
                        key={message.id}
                        className={
                          message.senderId === user.userId
                            ? 'message-row own'
                            : 'message-row'
                        }
                      >
                        <span className="message-sender">
                          {message.senderName}
                        </span>
                        <div className="message-bubble">{message.text}</div>
                        <small className="message-meta">
                          {new Date(message.createdAt).toLocaleString()}
                          {message.senderId === user.userId && <span className={'message-ticks ' + (message.readAt ? 'read' : message.deliveredAt ? 'delivered' : 'sent')} aria-label={message.readAt ? 'Read' : message.deliveredAt ? 'Delivered' : 'Sent'}>{message.readAt ? '✓✓' : message.deliveredAt ? '✓✓' : '✓'}</span>}
                        </small>
                      </div>
                    ))}
                    {messages.length === 0 && (
                      <div className="chat-empty">
                        <MessageCircle size={27} />
                        <b>Start the conversation</b>
                        <p>Keep job details and updates in this chat.</p>
                      </div>
                    )}
                  </div>
                  <form className="message-form" onSubmit={sendMessage}>
                    <input
                      value={messageText}
                      onChange={e => setMessageText(e.target.value)}
                      placeholder="Write a message…"
                      maxLength={2000}
                    />
                    <button
                      className="button button-primary"
                      type="submit"
                      disabled={busy || !messageText.trim()}
                    >
                      <ArrowRight size={16} /> Send
                    </button>
                  </form>
                </>
              ) : (
                <div className="chat-empty">
                  <MessageCircle size={30} />
                  <b>Select a job conversation</b>
                  <p>
                    Choose an accepted job on the left to view its messages.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'profile' && (
          <section className="content-section profile-edit-section">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">YOUR DETAILS</p>
                <h2>Profile</h2>
              </div>
              <span className="role-chip">
                {profile.role === 'worker'
                  ? 'Skilled professional'
                  : 'Customer account'}
              </span>
            </div>
            <form
              className="profile-form dashboard-profile-form"
              onSubmit={saveProfile}
            >
              <div className="profile-photo-editor">
                <span className="profile-photo-large">{profile.profileImage ? <img src={profile.profileImage} alt="Your profile" /> : profile.fullName.slice(0,1).toUpperCase()}</span>
                <label className="button button-outline">Change profile picture<input type="file" accept="image/*" hidden onChange={event => uploadProfileImage(event.target.files?.[0])} /></label>
              </div>
              <div className="form-grid">
                <label>
                  Full name
                  <input
                    required
                    value={profileForm.fullName}
                    onChange={e => updateProfile('fullName', e.target.value)}
                  />
                </label>
                <label>
                  Email
                  <input
                    required
                    type="email"
                    value={profileForm.email}
                    onChange={e => updateProfile('email', e.target.value)}
                  />
                </label>
                <label>
                  Phone
                  <input
                    required
                    type="tel"
                    value={profileForm.phone}
                    onChange={e => updateProfile('phone', e.target.value)}
                  />
                </label>
                <label>
                  Country
                  <input
                    required
                    value={profileForm.country}
                    onChange={e => updateProfile('country', e.target.value)}
                  />
                </label>
                <label>
                  State
                  <select required value={profileForm.state} onChange={e => updateProfile('state', e.target.value)}>
                    <option value="">Choose your state</option>
                    {nigeriaStates.map(state => <option key={state} value={state}>{state}</option>)}
                  </select>
                </label>
                <label>
                  Address / area
                  <input
                    required
                    value={profileForm.address}
                    onChange={e => updateProfile('address', e.target.value)}
                  />
                </label>
                {profile.role === 'worker' && (
                  <>
                    <div className="full-field skill-picker profile-skill-picker">
                      <b>Skills and services <span className="required-star">*</span></b>
                      <small>Select all the skills you offer. Choose Other if yours is not listed.</small>
                      <div className="skill-options">
                        {skillOptions.map(skill => {
                          const selected = profileForm.skills.split(',').map(item => item.trim()).includes(skill);
                          return <button key={skill} type="button" className={selected ? 'skill-option selected' : 'skill-option'} onClick={() => toggleSkill(skill)}>{selected ? '✓ ' : '+ '}{skill}</button>;
                        })}
                      </div>
                      {profileForm.skills.split(',').map(item => item.trim()).includes('Other') && <input required placeholder="Enter your skill or service" value={customSkill} onChange={e => setCustomSkill(e.target.value)} />}
                    </div>
                  </>
                )}
              </div>
              {profile.role === 'worker' && <div className="profile-availability-control"><div><b>Availability</b><p>{profile.available ? 'You are visible to customers and can receive applications.' : 'You are hidden from available worker listings.'}</p></div><button type="button" className={profile.available ? 'toggle on' : 'toggle'} onClick={toggleAvailability} disabled={busy} aria-label="Toggle availability"><span /></button></div>}
              <button
                className="button button-primary"
                type="submit"
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Save changes'} <Check size={16} />
              </button>

              <button
                className="button button-quiet"
                type="button"
                onClick={signOut}
              >
                <LogOut size={16} /> Log out
              </button>
            </form>
            <div className="verification-card"><ShieldCheck size={20} /><div><b>Identity verification · {profile.role === 'worker' ? 'Worker' : 'Customer'}</b><p>{profile.verificationStatus === 'verified' ? 'Your identity check is verified.' : profile.verificationStatus === 'pending' ? 'Your verification request is awaiting review.' : 'Verification will require an approved identity check using NIN and/or passport through a secure, authorised provider. SkillHub should not collect identity numbers or document photos directly.'}</p></div><button className="button button-outline button-small" disabled={verificationBusy || profile.verificationStatus === 'pending' || profile.verificationStatus === 'verified'} onClick={requestVerification}>{profile.verificationStatus === 'pending' ? 'Pending review' : profile.verificationStatus === 'verified' ? 'Verified' : 'Request verification'}</button></div>
            {profile.role === 'worker' && <section className="portfolio-section"><div className="section-title-row"><div><p className="eyebrow">SHOW YOUR WORK</p><h3>My portfolio</h3></div></div><div className="portfolio-publish"><textarea rows={2} maxLength={500} value={portfolioCaption} onChange={event => setPortfolioCaption(event.target.value)} placeholder="Add a short description of this work (optional)" /><label className="button button-primary">{portfolioBusy ? 'Publishing…' : 'Post a photo'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={portfolioBusy} onChange={event => publishPortfolio(event.target.files?.[0])} /></label></div><div className="portfolio-grid">{(data.portfolioPosts ?? []).filter(post => post.ownerId === user.userId).map(post => <article className="portfolio-post" key={post.id}><img src={post.imageUrl} alt="Worker portfolio" /><p>{post.caption}</p><button className="portfolio-like" onClick={() => togglePortfolioLike(post.id)}>♥ {post.likes} {post.likedByMe ? 'Liked' : 'Like'}</button><div className="portfolio-comments">{post.comments.map(comment => <p key={comment.id}><b>{comment.userName}:</b> {comment.text}</p>)}<div><input value={portfolioComment[post.id] ?? ''} onChange={event => setPortfolioComment(current => ({ ...current, [post.id]: event.target.value }))} placeholder="Write a comment…" /><button className="button button-outline button-small" onClick={() => addPortfolioComment(post.id)}>Comment</button></div></div></article>)}</div>{!(data.portfolioPosts ?? []).some(post => post.ownerId === user.userId) && <p className="empty-state">Your work photos will appear here. Post your first project when you're ready.</p>}</section>}
            {profile.role === 'worker' && <a className="button button-outline whatsapp-workers-link" href="https://chat.whatsapp.com/D5LeU6XlOT92UTt70pww23?s=cl&p=a&mlu=4&ilr=4&iam=2" target="_blank" rel="noreferrer"><Users size={17} /> Join the SkillHub Workers WhatsApp group</a>}
            <div className="profile-actions-row"><button type="button" className="button button-outline" onClick={() => setShowReportForm(true)}><ShieldAlert size={15} /> Report a problem</button><button type="button" className="button button-outline" onClick={() => setDarkMode(value => !value)}>{darkMode ? <Sun size={15} /> : <Moon size={15} />}{darkMode ? 'Light mode' : 'Dark mode'}</button></div>
            <div className="privacy-card">
              <ShieldCheck size={20} />
              <div>
                <b>Your details matter.</b>
                <p>
                  Your email, phone and full address stay private from public
                  worker listings. Use in-app messages to discuss a job before
                  sharing contact details.
                </p>
              </div>
            </div>
          </section>
        )}

        <footer className="dashboard-footer">
          <span>
            SkillHub <span className="footer-dot">●</span> Good work finds its
            people.
          </span>
          <span className="support-links">
            <a href="mailto:skill.hub.gtt@gmail.com" aria-label="Email SkillHub support"><Mail size={17} /> Email support</a>
            <a href="https://wa.me/2349015210112" target="_blank" rel="noreferrer" aria-label="WhatsApp SkillHub support"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 11.7a8.2 8.2 0 0 1-12.1 7.2L3 20l1.2-4.8A8.2 8.2 0 1 1 20.2 11.7Z"/><path d="M8.6 8.1c.2-.4.4-.5.7-.5h.5c.2 0 .3.1.4.4l.7 1.6c.1.2.1.4-.1.6l-.5.6c-.2.2-.2.3-.1.5.5.9 1.2 1.6 2.1 2.1.2.1.3.1.5-.1l.7-.8c.2-.2.3-.2.6-.1l1.5.7c.2.1.3.3.3.5 0 .4-.2 1-.6 1.3-.4.4-1 .6-1.6.5-1.1-.2-2.4-.8-3.7-2-1.1-1.1-1.9-2.5-2-3.4-.1-.7.2-1.4.6-1.9Z"/></svg> WhatsApp</a>
          </span>
        </footer>
      </section>

      {showReportForm && <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-header"><h2>Report a problem</h2><button className="icon-button" onClick={() => setShowReportForm(false)}><X size={18} /></button></div><p className="modal-description">Tell our team what happened. Include the job if this concerns a specific booking.</p><form className="profile-form" onSubmit={submitReport}><label>What happened?<textarea required minLength={10} rows={4} value={reportText} onChange={event => setReportText(event.target.value)} placeholder="Describe the issue clearly…" /></label><button className="button button-primary button-full" type="submit">Submit report</button></form></section></div>}

      {showOpportunityForm && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget)
              setShowOpportunityForm(false);
          }}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="opportunity-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">FIND THE RIGHT PERSON</p>
                <h2 id="opportunity-title">{jobForm.kind === 'team' ? 'Create a Team-Up' : 'Create an opportunity'}</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowOpportunityForm(false)}
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </div>
            <p className="modal-description">
              {jobForm.kind === 'team' ? 'Invite other skilled workers to join a project you are leading.' : 'Tell local professionals what you need. Workers with matching skills and areas can see the request.'}
            </p>
            <form className="profile-form" onSubmit={createOpportunity}>
              <label>
                Skill or service needed
                <input
                  required
                  value={jobForm.skill}
                  onChange={e =>
                    setJobForm(prev => ({ ...prev, skill: e.target.value }))
                  }
                  placeholder="e.g. Tailor, phone repair, chef"
                />
              </label>
              <label>
                Job location
                <input
                  required
                  value={jobForm.location}
                  onChange={e =>
                    setJobForm(prev => ({ ...prev, location: e.target.value }))
                  }
                  placeholder="Town, neighbourhood or state"
                />
              </label>
              <label>
                Describe the job
                <textarea
                  value={jobForm.details}
                  onChange={e =>
                    setJobForm(prev => ({ ...prev, details: e.target.value }))
                  }
                  rows={3}
                  placeholder="What do you need done? Add useful details."
                />
              </label>
              {jobForm.kind === 'team' && <label>How many additional workers do you need to join you?<input type="number" min={2} max={30} required value={jobForm.teamSize} onChange={e => setJobForm(prev => ({ ...prev, teamSize: Number(e.target.value) }))} /></label>}
              <label>
                Budget (optional)
                <input
                  value={jobForm.budget}
                  onChange={e =>
                    setJobForm(prev => ({ ...prev, budget: e.target.value }))
                  }
                  placeholder="e.g. ₦15,000 or Negotiable"
                />
              </label>
              {errorText && <p className="error-text">{errorText}</p>}
              <button
                className="button button-primary button-full"
                type="submit"
                disabled={busy}
              >
                {busy ? 'Posting…' : jobForm.kind === 'team' ? 'Post Team-Up' : 'Post opportunity'}{' '}
                <ArrowRight size={16} />
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
