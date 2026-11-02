import { router, json, error, db, requireAuth, storage } from '@appdeploy/sdk';
import { notifySubscribers, realtimeSubscriptionRoutes } from './realtime-subscribers';

type Profile = {
  role: 'worker' | 'customer';
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
  profileImagePath?: string;
  portfolio?: string;
  verificationStatus?: 'none' | 'pending' | 'verified';
};

type Application = {
  jobId: string;
  workerId: string;
  workerName: string;
  status: 'applied' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
};

type Opportunity = {
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
  kind?: 'job' | 'team';
  teamSize?: number;
  workerIds?: string[];
  completionConfirmedBy?: string[];
};

async function getProfile(userId: string) {
  const [profile] = await db.get<Profile>('profiles', [userId]);
  return profile;
}

function cleanText(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function requireProfile(userId: string) {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('PROFILE_REQUIRED');
  return profile;
}

async function getOpportunity(id: string) {
  const [job] = await db.get<Opportunity>('opportunities', [id]);
  return job;
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],

  'GET /api/bootstrap': [
    requireAuth(),
    async ({ user }) => {
      const currentUser = user!;
      const [storedProfile] = await db.get<Profile>('profiles', [currentUser.userId]);
      let profile = storedProfile;
      if (storedProfile?.profileImagePath) {
        try {
          const [{ url }] = await storage.url([storedProfile.profileImagePath]);
          profile = { ...storedProfile, profileImage: url };
        } catch { /* keep the last saved image URL as a fallback */ }
      }
      const profilesPage = await db.list<Profile>('profiles', { limit: 100 });
      const jobsPage = await db.list<Opportunity>('opportunities', {
        limit: 100,
      });
      const ratingsPage = await db.list<{ targetId: string; score: number; raterId?: string; jobId?: string }>('ratings', { limit: 500 });
      const savedPage = await db.list<{ userId: string; workerId: string }>('savedWorkers', { limit: 500 });
      const savedWorkerIds = savedPage.items.filter(item => item.userId === currentUser.userId).map(item => item.workerId);
      const applicationsPage = await db.list<Application>('applications', { limit: 500 });
      const notificationsPage = await db.list<{ userId: string; title: string; body: string; createdAt: string; read: boolean }>('notifications', { limit: 200 });
      const portfolioPage = await db.list<{ ownerId: string; caption: string; imagePath: string; createdAt: string }>('portfolioPosts', { limit: 300 });
      const portfolioCommentPage = await db.list<{ postId: string; userId: string; userName: string; text: string; createdAt: string }>('portfolioComments', { limit: 500 });
      const portfolioLikePage = await db.list<{ postId: string; userId: string }>('portfolioLikes', { limit: 1000 });
      const portfolioPaths = [...new Set(portfolioPage.items.map(post => post.imagePath))];
      const portfolioUrls = portfolioPaths.length ? await storage.url(portfolioPaths) : [];
      const portfolioUrlByPath = new Map(portfolioUrls.map(item => [item.path, item.url]));
      const portfolioPosts = portfolioPage.items.map(post => ({
        id: (post as typeof post & { id: string }).id, ownerId: post.ownerId, caption: post.caption,
        imageUrl: portfolioUrlByPath.get(post.imagePath), createdAt: post.createdAt,
        likes: portfolioLikePage.items.filter(like => like.postId === (post as typeof post & { id: string }).id).length,
        likedByMe: portfolioLikePage.items.some(like => like.postId === (post as typeof post & { id: string }).id && like.userId === currentUser.userId),
        comments: portfolioCommentPage.items.filter(comment => comment.postId === (post as typeof post & { id: string }).id).map(comment => ({ ...comment, id: (comment as typeof comment & { id: string }).id })),
      }));
      const notifications = notificationsPage.items.filter(item => item.userId === currentUser.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const applications = applicationsPage.items;
      const ratings = ratingsPage.items;
      const ratedJobIds = ratings.filter(item => item.raterId === currentUser.userId).map(item => item.jobId).filter((id): id is string => Boolean(id));
      const imagePaths = [...new Set(profilesPage.items.map(item => item.profileImagePath).filter((path): path is string => Boolean(path)))];
      const imageUrls = imagePaths.length ? await storage.url(imagePaths) : [];
      const imageByPath = new Map(imageUrls.map(item => [item.path, item.url]));
      const freshImage = (item: Profile) => item.profileImagePath ? imageByPath.get(item.profileImagePath) : item.profileImage;
      const workers = profilesPage.items
        .filter(item => item.role === 'worker')
        .map(item => {
          const ownRatings = ratings.filter(
            rating => rating.targetId === item.id
          );
          const average = ownRatings.length
            ? ownRatings.reduce((sum, rating) => sum + rating.score, 0) /
              ownRatings.length
            : 0;
          return {
            id: item.id,
            role: item.role,
            fullName: item.fullName,
            country: item.country,
            state: item.state,
            skills: item.skills,
            available: item.available,
            rating: average,
            ratingCount: ownRatings.length,
            profileImage: freshImage(item),
            portfolio: item.portfolio,
            verified: item.verificationStatus === 'verified',
          };
        })
        .filter(item => item.available);

      const jobs = jobsPage.items;
      const openOpportunities = jobs
        .filter(job => job.status === 'open' && job.customerId !== currentUser.userId && !(profile?.role === 'worker' && applications.some(app => app.jobId === (job as Opportunity & { id: string }).id && app.workerId === currentUser.userId)))
        .map(job => ({
          id: (job as Opportunity & { id?: string }).id,
          ...job,
        }));
      const myJobs = jobsPage.items
        .filter(job => {
          const item = job as Opportunity & { id: string };
          return item.customerId === currentUser.userId || item.workerId === currentUser.userId || (item.workerIds ?? []).includes(currentUser.userId) || applications.some(app => app.jobId === item.id && app.workerId === currentUser.userId);
        })
        .map(job => {
          const item = job as Opportunity & { id: string };
          const ownApplication = applications.find(app => app.jobId === item.id && app.workerId === currentUser.userId);
          return {
            ...job,
            id: item.id,
            ...(item.customerId === currentUser.userId
              ? { applicants: applications.filter(app => app.jobId === item.id).map(app => {
                  const worker = profilesPage.items.find(profile => profile.id === app.workerId);
                  const workerRatings = ratings.filter(rating => rating.targetId === app.workerId);
                  const average = workerRatings.length ? workerRatings.reduce((sum, rating) => sum + rating.score, 0) / workerRatings.length : 0;
                  return { ...app, id: (app as Application & { id: string }).id, workerSkills: worker?.skills ?? '', workerState: worker?.state ?? '', workerRating: average, workerRatingCount: workerRatings.length, workerImage: worker ? freshImage(worker) : undefined, workerVerified: worker?.verificationStatus === 'verified' };
                }) }
              : {}),
            ...(ownApplication ? { myApplicationStatus: ownApplication.status } : {}),
            isOwner: item.customerId === currentUser.userId,
            completionConfirmedBy: item.completionConfirmedBy ?? [],
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const acceptedMyJobs = myJobs.filter(job => job.status === 'accepted');
      const ownCompletionIds = acceptedMyJobs.map(job => (job.id + '_' + currentUser.userId).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 180));
      if (ownCompletionIds.length) {
        const ownConfirmations = await db.get<{ jobId: string; userId: string }>('completionConfirmations', ownCompletionIds, { consistent: true });
        acceptedMyJobs.forEach((job, index) => {
          const confirmation = ownConfirmations[index];
          if (confirmation?.jobId === job.id && confirmation.userId === currentUser.userId) {
            job.completionConfirmedBy = [...new Set([...(job.completionConfirmedBy ?? []), currentUser.userId])];
          }
        });
      }

      return json({
        user: {
          userId: currentUser.userId,
          email: currentUser.email,
          name: currentUser.name,
        },
        profile,
        workers,
        opportunities: openOpportunities,
        myJobs,
        notifications,
        ratedJobIds,
        savedWorkerIds,
        portfolioPosts,
      });
    },
  ],

  'POST /api/profile': [
    requireAuth(),
    async ({ body, user }) => {
      const currentUser = user!;
      const input = (body ?? {}) as Record<string, unknown>;
      const role =
        input.role === 'worker'
          ? 'worker'
          : input.role === 'customer'
            ? 'customer'
            : null;
      const fullName = cleanText(input.fullName, 100);
      const email = cleanText(input.email, 200).toLowerCase();
      const phone = cleanText(input.phone, 50);
      const address = cleanText(input.address, 180);
      const country = cleanText(input.country, 100);
      const state = cleanText(input.state, 100);
      const skills = cleanText(input.skills, 500);
      const portfolio = cleanText(input.portfolio, 500);
      if (
        !role ||
        !fullName ||
        !email ||
        !phone ||
        !address ||
        !country ||
        !state
      ) {
        return error('Please complete all required profile fields.', 400);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return error('Enter a valid email address.', 400);
      }
      if (role === 'worker' && !skills) {
        return error('Add at least one skill or service.', 400);
      }
      const existing = await getProfile(currentUser.userId);
      const profile: Profile = {
        role,
        fullName,
        email,
        phone,
        address,
        country,
        state,
        skills,
        available:
          role === 'worker'
            ? typeof input.available === 'boolean'
              ? input.available
              : (existing?.available ?? true)
            : false,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        profileImage: existing?.profileImage,
        profileImagePath: existing?.profileImagePath,
        portfolio,
        verificationStatus: existing?.verificationStatus ?? 'none',
      };
      const [saved] = await db.tx.update('profiles', [
        {
          id: currentUser.userId,
          record: profile,
        },
      ]);
      if (!saved)
        return error('Could not save your profile. Please try again.', 500);
      return json({ profile: { ...profile, id: currentUser.userId } });
    },
  ],

  'POST /api/profile/avatar': [
    requireAuth(),
    async ({ body, user }) => {
      const currentUser = user!;
      const input = (body ?? {}) as Record<string, unknown>;
      const base64 = cleanText(input.base64, 7_000_000);
      const contentType = cleanText(input.contentType, 80);
      if (!base64 || !/^image\/(jpeg|png|webp)$/.test(contentType)) return error('Upload a JPG, PNG or WebP image.', 400);
      const profile = await requireProfile(currentUser.userId);
      const path = 'profile-images/' + currentUser.userId + '.' + (contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp');
      const [ok] = await storage.write([{ path, content: base64, contentType }]);
      if (!ok) return error('Could not save the profile picture.', 500);
      const [{ url }] = await storage.url([path]);
      await db.tx.update('profiles', [{ id: currentUser.userId, record: { profileImage: url, profileImagePath: path } }], { patch: true });
      return json({ url, path });
    },
  ],

  'POST /api/profile/verification': [
    requireAuth(),
    async ({ user }) => {
      const currentUser = user!;
      const profile = await requireProfile(currentUser.userId);
      if (profile.verificationStatus === 'verified') return error('This profile is already verified.', 409);
      await db.tx.update('profiles', [{ id: currentUser.userId, record: { verificationStatus: 'pending' } }], { patch: true });
      await db.add('verificationRequests', [{ userId: currentUser.userId, fullName: profile.fullName, role: profile.role, method: 'external_identity_provider_required', createdAt: new Date().toISOString(), status: 'pending' }]);
      return json({ submitted: true, status: 'pending' });
    },
  ],

  'POST /api/portfolio': [
    requireAuth(),
    async ({ body, user }) => {
      const currentUser = user!;
      const profile = await requireProfile(currentUser.userId);
      if (profile.role !== 'worker') return error('Only workers can publish portfolio posts.', 403);
      const input = (body ?? {}) as Record<string, unknown>;
      const base64 = cleanText(input.base64, 7_000_000);
      const contentType = cleanText(input.contentType, 80);
      const caption = cleanText(input.caption, 500);
      if (!base64 || !/^image\/(jpeg|png|webp)$/.test(contentType)) return error('Upload a JPG, PNG or WebP image.', 400);
      const postId = 'portfolio_' + currentUser.userId + '_' + Date.now();
      const path = 'portfolio-images/' + postId + '.' + (contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp');
      const [ok] = await storage.write([{ path, content: base64, contentType }]);
      if (!ok) return error('Could not save this portfolio image.', 500);
      const [id] = await db.add('portfolioPosts', [{ ownerId: currentUser.userId, caption, imagePath: path, createdAt: new Date().toISOString() }]);
      const [{ url }] = await storage.url([path]);
      return id ? json({ id, imageUrl: url }) : error('Could not publish this portfolio post.', 500);
    },
  ],
  'POST /api/portfolio/:postId/like': [
    requireAuth(),
    async ({ params, user }) => {
      const currentUser = user!;
      const postPage = await db.list<{ ownerId: string }>('portfolioPosts', { limit: 300 });
      const post = postPage.items.find(item => (item as typeof item & { id: string }).id === params.postId);
      if (!post) return error('Portfolio post not found.', 404);
      const likeId = (params.postId + '_' + currentUser.userId).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 180);
      const existing = await db.get('portfolioLikes', [likeId]);
      if (existing[0]) { await db.delete('portfolioLikes', [likeId]); return json({ liked: false }); }
      await db.tx.add('portfolioLikes', [{ id: likeId, postId: params.postId, userId: currentUser.userId }]);
      return json({ liked: true });
    },
  ],
  'POST /api/portfolio/:postId/comments': [
    requireAuth(),
    async ({ params, body, user }) => {
      const currentUser = user!;
      const profile = await requireProfile(currentUser.userId);
      const postPage = await db.list<{ ownerId: string }>('portfolioPosts', { limit: 300 });
      if (!postPage.items.some(item => (item as typeof item & { id: string }).id === params.postId)) return error('Portfolio post not found.', 404);
      const text = cleanText((body as Record<string, unknown> | null)?.text, 500);
      if (!text) return error('Write a comment first.', 400);
      const [id] = await db.add('portfolioComments', [{ postId: params.postId, userId: currentUser.userId, userName: profile.fullName, text, createdAt: new Date().toISOString() }]);
      return id ? json({ created: true }) : error('Could not add comment.', 500);
    },
  ],
  'POST /api/reports': [
    requireAuth(),
    async ({ body, user }) => {
      const currentUser = user!;
      const input = (body ?? {}) as Record<string, unknown>;
      const details = cleanText(input.details, 2000);
      const jobId = cleanText(input.jobId, 200);
      if (details.length < 10) return error('Please provide at least 10 characters.', 400);
      if (jobId) {
        const job = await getOpportunity(jobId);
        const participants = job ? [job.customerId, job.workerId, ...(job.workerIds ?? [])].filter(Boolean) : [];
        if (!job || !participants.includes(currentUser.userId)) return error('Only a participant in this job can report it.', 403);
      }
      const [id] = await db.add('reports', [{ reporterId: currentUser.userId, jobId: jobId || null, details, status: 'open', createdAt: new Date().toISOString() }]);
      return id ? json({ submitted: true }) : error('Could not submit report.', 500);
    },
  ],

  'POST /api/opportunities': [
    requireAuth(),
    async ({ body, user }) => {
      const currentUser = user!;
      const profile = await requireProfile(currentUser.userId).catch(
        () => null
      );
      if (!profile) return error('Please complete your profile first.', 400);
      const input = (body ?? {}) as Record<string, unknown>;
      const kind = input.kind === 'team' ? 'team' : 'job';
      if (kind === 'job' && profile.role !== 'customer') return error('Only customer accounts can create service jobs.', 403);
      if (kind === 'team' && profile.role !== 'worker') return error('Team-Up posts are for worker accounts.', 403);
      const skill = cleanText(input.skill, 140);
      const location = cleanText(input.location, 180);
      const details = cleanText(input.details, 1500);
      const budget = cleanText(input.budget, 100);
      const teamSize = Math.max(2, Math.min(30, Math.floor(Number(input.teamSize) || 2)));
      if (!skill || !location)
        return error('Skill and job location are required.', 400);
      const [id] = await db.add('opportunities', [
        {
          customerId: currentUser.userId,
          customerName: profile.fullName,
          ownerRole: profile.role,
          kind,
          teamSize: kind === 'team' ? teamSize : undefined,
          workerIds: [],
          workerId: null,
          workerName: null,
          skill,
          location,
          details,
          budget,
          status: 'open',
          createdAt: new Date().toISOString(),
        },
      ]);      if (!id)
        return error('Could not post this opportunity. Please try again.', 500);
      return json({ id, created: true });
    },
  ],

  'POST /api/opportunities/:id/apply': [
    requireAuth(),
    async ({ params, user }) => {
      const currentUser = user!;
      const profile = await requireProfile(currentUser.userId).catch(() => null);
      if (!profile || profile.role !== 'worker') return error('Only worker accounts can apply for jobs.', 403);
      if (!profile.available) return error('Mark yourself available before applying.', 400);
      const job = await getOpportunity(params.id);
      if (!job || job.status !== 'open') return error('This job is no longer accepting applications.', 409);
      if (!job.skill.toLowerCase().split(/[,/ ]+/).some(word => word.length > 2 && profile.skills.toLowerCase().includes(word))) {
        return error('Your listed skills do not appear to match this job. Update your profile if needed.', 400);
      }
      const applicationId = (params.id + '_' + currentUser.userId).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 180);
      const applicationWrite = db.tx.add('applications', [{
        id: applicationId,
        jobId: params.id,
        workerId: currentUser.userId,
        workerName: profile.fullName,
        status: 'applied',
        createdAt: new Date().toISOString(),
      }]);
      // Couple application creation to the job's open-state condition. This closes
      // the race where cancellation commits after the initial read but before apply.
      const openJobGuard = db.tx.update('opportunities', [{
        id: params.id,
        record: { status: 'open' },
        if: { status: 'open' },
      }], { patch: true });
      try {
        const [applicationIds] = await db.transact([applicationWrite, openJobGuard]);
        const id = applicationIds[0];
        if (!id) return error('You have already applied for this job.', 409);
        await db.add('notifications', [{
          userId: job.customerId,
          title: 'New worker application',
          body: profile.fullName + ' applied for ' + job.skill,
          jobId: params.id,
          read: false,
          createdAt: new Date().toISOString(),
        }]);
        return json({ applied: true, id });
      } catch (err: unknown) {
        // A duplicate chosen ID aborts the transaction; verify the existing row
        // before classifying it as an ordinary duplicate application.
        const [existing] = await db.get<{ jobId: string; workerId: string }>('applications', [applicationId], { consistent: true });
        if (existing?.jobId === params.id && existing.workerId === currentUser.userId) {
          return error('You have already applied for this job.', 409);
        }
        const latestJob = await getOpportunity(params.id);
        if (!latestJob || latestJob.status !== 'open') return error('This job is no longer accepting applications.', 409);
        throw err;
      }
    },
  ],

  'POST /api/opportunities/:id/choose': [
    requireAuth(),
    async ({ params, body, user }) => {
      const currentUser = user!;
      const job = await getOpportunity(params.id);
      if (!job) return error('Opportunity not found.', 404);
      if (job.customerId !== currentUser.userId) return error('Only the customer who posted this job can choose a worker.', 403);
      if (job.status !== 'open') return error('This job is no longer open.', 409);
      const workerId = cleanText((body as Record<string, unknown> | null)?.workerId, 200);
      const applicationsPage = await db.list<Application>('applications', { limit: 500 });
      const applicants = applicationsPage.items.filter(app => app.jobId === params.id);
      const chosen = applicants.find(app => app.workerId === workerId && app.status === 'applied');
      if (!chosen) return error('That application is no longer available.', 404);
      if (job.kind === 'team') {
        const workerIds = [...new Set([...(job.workerIds ?? []), workerId])];
        const filled = workerIds.length >= (job.teamSize ?? 2);
        // Compare the exact membership snapshot read above. A status-only condition
        // lets two concurrent team additions overwrite each other's workerIds arrays.
        const teamJobUpdate = db.tx.update('opportunities', [{
          id: params.id,
          record: { workerIds, workerId: workerIds[0], workerName: chosen.workerName, status: filled ? 'accepted' : 'open' },
          if: { status: 'open', workerIds: job.workerIds },
        }], { patch: true });
        const chosenApplicationUpdate = db.tx.update('applications', [{ id: chosen.id, record: { status: 'accepted' }, if: { status: 'applied' } }], { patch: true });
        try {
          const [jobResults, applicationResults] = await db.transact([teamJobUpdate, chosenApplicationUpdate]);
          if (!jobResults?.[0] || !applicationResults?.[0]) return error('The team request or application changed. Refresh and try again.', 409);
        } catch {
          return error('The team request or application changed. Refresh and try again.', 409);
        }
        await db.add('notifications', [{ userId: workerId, title: 'You joined a team', body: 'You were added to the team for ' + job.skill, jobId: params.id, read: false, createdAt: new Date().toISOString() }]);
        if (filled) {
          for (const applicant of applicants.filter(app => app.status === 'applied' && !workerIds.includes(app.workerId))) {
            await db.tx.update('applications', [{ id: applicant.id, record: { status: 'declined' }, if: { status: 'applied' } }], { patch: true });
            await db.add('notifications', [{ userId: applicant.workerId, title: 'Team is full', body: 'The team for ' + job.skill + ' is now full.', jobId: params.id, read: false, createdAt: new Date().toISOString() }]);
          }
        }
        return json({ chosen: true, workerId, teamFilled: filled, teamCount: workerIds.length });
      }
      const jobUpdate = db.tx.update('opportunities', [{ id: params.id, record: { status: 'accepted', workerId, workerName: chosen.workerName, workerIds: [workerId] }, if: { status: 'open' } }], { patch: true });
      const applicationUpdates = db.tx.update('applications', applicants.filter(app => app.status === 'applied').map(app => ({ id: app.id, record: { status: app.workerId === workerId ? 'accepted' : 'declined' }, if: { status: 'applied' } })), { patch: true });
      try {
        const [jobResult, applicationResults] = await db.transact([jobUpdate, applicationUpdates]);
        if (!jobResult?.[0] || applicationResults.some(result => !result)) return error('The job changed while you were choosing. Refresh and try again.', 409);
      } catch {
        return error('The job changed while you were choosing. Refresh and try again.', 409);
      }
      await db.add('notifications', [{ userId: workerId, title: 'You were selected', body: 'You were selected for ' + job.skill, jobId: params.id, read: false, createdAt: new Date().toISOString() }]);
      for (const applicant of applicants.filter(app => app.workerId !== workerId && app.status === 'applied')) await db.add('notifications', [{ userId: applicant.workerId, title: 'Application update', body: 'The customer selected another worker for ' + job.skill, jobId: params.id, read: false, createdAt: new Date().toISOString() }]);
      return json({ chosen: true, workerId });
    },
  ],

  'DELETE /api/opportunities/:id': [
    requireAuth(),
    async ({ params, user }) => {
      const currentUser = user!;
      const job = await getOpportunity(params.id);
      if (!job) return error('Opportunity not found.', 404);
      if (job.customerId !== currentUser.userId) return error('Only the customer who posted this job can delete it.', 403);
      if (job.status !== 'open') return error('Only open jobs can be deleted. Completed or assigned jobs stay in history.', 409);
      const applicationsPage = await db.list<Application>('applications', { limit: 500 });
      const applicants = applicationsPage.items.filter(app => app.jobId === params.id && app.status === 'applied');
      const jobUpdate = db.tx.update('opportunities', [{ id: params.id, record: { status: 'cancelled', cancelledAt: new Date().toISOString() }, if: { status: 'open' } }], { patch: true });
      const applicationUpdates = applicants.length ? db.tx.update('applications', applicants.map(app => ({ id: app.id, record: { status: 'cancelled' }, if: { status: 'applied' } })), { patch: true }) : null;
      try {
        if (applicationUpdates) await db.transact([jobUpdate, applicationUpdates]);
        else await jobUpdate;
      } catch {
        return error('This job changed while being deleted. Refresh and try again.', 409);
      }
      return json({ cancelled: true });
    },
  ],

  'POST /api/opportunities/:id/accept': [
    requireAuth(),
    async ({ params, user }) => {
      const currentUser = user!;
      const profile = await requireProfile(currentUser.userId).catch(
        () => null
      );
      if (!profile || profile.role !== 'worker')
        return error('Only worker accounts can accept jobs.', 403);
      if (!profile.available)
        return error(
          'Mark your profile available before accepting a job.',
          400
        );
      const job = await getOpportunity(params.id);
      if (!job) return error('Opportunity not found.', 404);
      const [accepted] = await db.tx.update(
        'opportunities',
        [
          {
            id: params.id,
            record: {
              status: 'accepted',
              workerId: currentUser.userId,
              workerName: profile.fullName,
            },
            if: { status: 'open' },
          },
        ],        { patch: true }
      );
      if (!accepted)
        return error(
          'This opportunity has already been accepted or is no longer open.',
          409
        );
      return json({ accepted: true, id: params.id });
    },
  ],

  'POST /api/opportunities/:id/complete': [
    requireAuth(),
    async ({ params, user }) => {
      const currentUser = user!;
      const job = (await getOpportunity(params.id)) as
        | (Opportunity & { id?: string })
        | null;
      if (!job) return error('Opportunity not found.', 404);
      const participants = [job.customerId, job.workerId, ...(job.workerIds ?? [])].filter(Boolean);
      if (!participants.includes(currentUser.userId)) return error('You are not a participant in this job.', 403);
      if (job.status !== 'accepted')
        return error('Only accepted jobs can be marked complete.', 400);
      const required = [...new Set([job.customerId, ...(job.workerIds?.length ? job.workerIds : job.workerId ? [job.workerId] : [])])];
      const confirmationId = (params.id + '_' + currentUser.userId).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 180);
      const [confirmationCreated] = await db.tx.add('completionConfirmations', [{
        id: confirmationId,
        jobId: params.id,
        userId: currentUser.userId,
        confirmedAt: new Date().toISOString(),
      }]);
      // A null result is an idempotent duplicate only if the keyed record exists.
      if (!confirmationCreated) {
        const [existingConfirmation] = await db.get<{ jobId: string; userId: string }>('completionConfirmations', [confirmationId], { consistent: true });
        if (!existingConfirmation || existingConfirmation.jobId !== params.id || existingConfirmation.userId !== currentUser.userId) {
          return error('Could not record your completion confirmation. Please try again.', 500);
        }
      }
      const confirmationIds = required.map(id => (params.id + '_' + id).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 180));
      const confirmations = await db.get<{ jobId: string; userId: string }>('completionConfirmations', confirmationIds, { consistent: true });
      const confirmedIds = required.filter((id, index) => {
        const record = confirmations[index];
        return record?.jobId === params.id && record.userId === id;
      });
      const completedNow = confirmedIds.length === required.length;
      if (completedNow) {
        const [updated] = await db.tx.update('opportunities', [{
          id: params.id,
          record: { status: 'completed', completionConfirmedAt: new Date().toISOString() },
          if: { status: 'accepted' },
        }], { patch: true });
        if (!updated) {
          const latest = await getOpportunity(params.id);
          if (latest?.status !== 'completed') return error('This job status changed. Refresh and try again.', 409);
        }
      }
      for (const participant of required.filter(id => id !== currentUser.userId)) await db.add('notifications', [{
        userId: participant,
        title: completedNow ? 'Job completed' : 'Completion confirmation needed',
        body: completedNow ? 'Both sides confirmed ' + job.skill + ' is complete.' : 'The other party marked ' + job.skill + ' complete. Please confirm in Jobs.',
        jobId: params.id,
        read: false,
        createdAt: new Date().toISOString(),
      }]);
      return json({ completed: completedNow, confirmed: true, confirmations: confirmedIds.length, required: required.length });
    },
  ],

  'GET /api/messages/:jobId': [
    requireAuth(),
    async ({ params, query, user }) => {
      const currentUser = user!;
      const job = await getOpportunity(params.jobId);
      if (!job) return error('Job conversation not found.', 404);
      if (
        ![job.customerId, job.workerId, ...(job.workerIds ?? [])].filter(Boolean).includes(currentUser.userId)
      ) {
        return error('You do not have access to this conversation.', 403);
      }
      const page = await db.list<{
        jobId: string; senderId: string; senderName: string; text: string; createdAt: string;
        deliveredAt?: string; readAt?: string;
      }>('messages', { limit: 100, ...(query.nextToken ? { nextToken: query.nextToken } : {}) });
      const incoming = page.items.filter(message => message.jobId === params.jobId && message.senderId !== currentUser.userId && !message.deliveredAt);
      const deliveredAt = new Date().toISOString();
      if (incoming.length) await db.tx.update('messages', incoming.map(message => ({
        id: message.id,
        record: { deliveredAt },
        if: { jobId: params.jobId, senderId: message.senderId, deliveredAt: undefined },
      })), { patch: true });
      const messages = page.items
        .filter(message => message.jobId === params.jobId)
        .map(message => ({ ...message, id: message.id, ...(incoming.some(item => item.id === message.id) ? { deliveredAt } : {}) }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return json({ messages, nextToken: page.nextToken ?? null });
    },
  ],

  'POST /api/messages/:jobId/read': [
    requireAuth(),
    async ({ params, body, user }) => {
      const currentUser = user!;
      const job = await getOpportunity(params.jobId);
      if (!job || (![job.customerId, job.workerId, ...(job.workerIds ?? [])].filter(Boolean).includes(currentUser.userId))) return error('You do not have access to this conversation.', 403);
      const input = (body ?? {}) as Record<string, unknown>;
      const requestedIds = Array.isArray(input.messageIds)
        ? [...new Set(input.messageIds.map(id => cleanText(id, 200)).filter(Boolean))].slice(0, 100)
        : [];
      if (!requestedIds.length) return json({ read: true, updated: 0 });
      const records = await db.get<{ jobId: string; senderId: string; readAt?: string }>('messages', requestedIds, { consistent: true });
      const readAt = new Date().toISOString();
      const updates = records.flatMap((message, index) =>
        message && message.jobId === params.jobId && message.senderId !== currentUser.userId && !message.readAt
          ? [{ id: requestedIds[index], record: { readAt }, if: { jobId: params.jobId, senderId: message.senderId, readAt: undefined } }]
          : []
      );
      if (updates.length) await db.tx.update('messages', updates, { patch: true });
      return json({ read: true, updated: updates.length });
    },
  ],

  'POST /api/messages': [
    requireAuth(),
    async ({ body, user }) => {
      const currentUser = user!;
      const input = (body ?? {}) as Record<string, unknown>;
      const jobId = cleanText(input.jobId, 200);
      const text = cleanText(input.text, 2000);
      if (!jobId || !text) return error('Enter a message before sending.', 400);
      const job = await getOpportunity(jobId);
      if (!job) return error('Job conversation not found.', 404);
      if (
        ![job.customerId, job.workerId, ...(job.workerIds ?? [])].filter(Boolean).includes(currentUser.userId)
      ) {
        return error('You do not have access to this conversation.', 403);
      }
      const profile = await requireProfile(currentUser.userId).catch(
        () => null
      );
      if (!profile) return error('Please complete your profile first.', 400);
      const createdAt = new Date().toISOString();
      const [id] = await db.add('messages', [{ jobId, senderId: currentUser.userId, senderName: profile.fullName, text, createdAt, deliveryStatus: 'sent' }]);
      if (!id) return error('Message could not be sent.', 500);
      await notifySubscribers('job-chat', jobId, { message: { id, jobId, senderId: currentUser.userId, senderName: profile.fullName, text, createdAt } });
      return json({ id, sent: true });
    },
  ],

  'POST /api/ratings': [
    requireAuth(),
    async ({ body, user }) => {
      const currentUser = user!;
      const input = (body ?? {}) as Record<string, unknown>;
      const jobId = cleanText(input.jobId, 200);
      const targetId = cleanText(input.targetId, 200);
      const score = Number(input.score);
      if (
        !jobId ||
        !targetId ||
        !Number.isInteger(score) ||
        score < 1 ||
        score > 5
      ) {
        return error('Choose a rating from 1 to 5 stars.', 400);
      }
      const job = await getOpportunity(jobId);
      if (!job || job.status !== 'completed')
        return error('Ratings are available after a job is completed.', 400);
      const participants = [job.customerId, ...(job.workerIds?.length ? job.workerIds : job.workerId ? [job.workerId] : [])].filter(Boolean);
      const otherParticipant = participants.includes(currentUser.userId) && targetId !== currentUser.userId && participants.includes(targetId) ? targetId : null;
      if (
        !otherParticipant ||
        otherParticipant !== targetId ||
        targetId === currentUser.userId
      ) {
        return error(
          'You can only rate the other person in your completed job.',
          403
        );
      }
      const ratingId = (jobId + '_' + currentUser.userId)
        .replace(/[^A-Za-z0-9_.-]/g, '_')
        .slice(0, 180);
      const [id] = await db.tx.add('ratings', [
        {
          id: ratingId,
          jobId,
          raterId: currentUser.userId,
          targetId,
          score,
          createdAt: new Date().toISOString(),
        },
      ]);
      if (!id) return error('You have already rated this job.', 409);
      return json({ submitted: true });
    },
  ],

  'POST /api/saved-workers': [
    requireAuth(),
    async ({ body, user }) => {
      const currentUser = user!;
      const workerId = cleanText((body as Record<string, unknown> | null)?.workerId, 200);
      if (!workerId || workerId === currentUser.userId) return error('Choose a valid worker.', 400);
      const worker = await getProfile(workerId);
      if (!worker || worker.role !== 'worker') return error('Worker not found.', 404);
      const saveId = (currentUser.userId + '_' + workerId).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 180);
      const [id] = await db.tx.add('savedWorkers', [{ id: saveId, userId: currentUser.userId, workerId, createdAt: new Date().toISOString() }]);
      return id ? json({ saved: true }) : error('This worker is already saved.', 409);
    },
  ],
  'DELETE /api/saved-workers/:workerId': [
    requireAuth(),
    async ({ params, user }) => {
      const currentUser = user!;
      const saveId = (currentUser.userId + '_' + params.workerId).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 180);
      await db.delete('savedWorkers', [saveId]);
      return json({ saved: false });
    },
  ],
  ...realtimeSubscriptionRoutes,
});
