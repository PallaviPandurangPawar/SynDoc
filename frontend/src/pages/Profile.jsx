// My Profile page — renders inside AppLayout's <Outlet />
import { useEffect, useRef, useState } from 'react';
import { getProfile, updateProfile } from '../services/api';
import Loader from '../components/Loader/Loader';
import { useAuth } from '../context/AuthContext';
import './Profile.css';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

export default function Profile() {
  const { user, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [about, setAbout] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [savedProfile, setSavedProfile] = useState({ name: '', address: '', email: '', phone: '', about: '' });

  const nameRef = useRef(null);
  const addressRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const aboutRef = useRef(null);
  const submitBtnRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await getProfile();
      const p = res.data || {};
      setName(p.name || '');
      setAddress(p.address || '');
      setEmail(p.email || '');
      setPhone(p.phone || '');
      setAbout(p.about || '');
      setAvatarPreview(p.avatarData || '');
      setSavedProfile({
        name: p.name || '',
        address: p.address || '',
        email: p.email || '',
        phone: p.phone || '',
        about: p.about || ''
      });
    } catch {
      setError('Could not load your profile. Is the backend running on port 5000?');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      alert('Please choose an image smaller than 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('Name cannot be empty.');
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const res = await updateProfile({ name, address, email, phone, about, avatarData: avatarPreview });
      const p = res.data || {};
      updateUser({ ...user, name: p.name, email: p.email, avatarData: p.avatarData });
      setSavedProfile({
        name: p.name || '',
        address: p.address || '',
        email: p.email || '',
        phone: p.phone || '',
        about: p.about || ''
      });
      alert('Profile updated successfully.');
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to update profile.';
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading profile..." />;
  if (error) return <p style={{ padding: '24px', color: 'salmon' }}>{error}</p>;

  return (
    <div className="page-inner">
      <div className="profile-content">
        <div className="profile-avatar-col">
          <div className="profile-avatar-outer">
            <div className="profile-avatar-circle">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Your avatar" />
            ) : (
              <svg className="avatar-svg" viewBox="0 0 100 100" width="100%" height="100%">
                <defs>
                  <linearGradient id="p-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4a4b52" />
                    <stop offset="50%" stopColor="#2d2f36" />
                    <stop offset="100%" stopColor="#1c1d22" />
                  </linearGradient>
                  <linearGradient id="p-hair-grad" x1="0%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor="#3d3738" />
                    <stop offset="50%" stopColor="#222023" />
                    <stop offset="100%" stopColor="#141315" />
                  </linearGradient>
                  <linearGradient id="p-skin-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fde8db" />
                    <stop offset="100%" stopColor="#f5ceba" />
                  </linearGradient>
                  <linearGradient id="p-hoodie-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f7f7f9" />
                    <stop offset="100%" stopColor="#d6d9e0" />
                  </linearGradient>
                  <linearGradient id="p-orange-strap" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f87b50" />
                    <stop offset="100%" stopColor="#e3562a" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="50" fill="url(#p-bg-grad)" />
                <path d="M18 95 C21 72 32 66 50 66 C68 66 79 72 82 95 Z" fill="url(#p-hoodie-grad)" />
                <path d="M26 95 C28 80 34 72 38 69 L42 73 C38 77 34 84 32 95 Z" fill="url(#p-orange-strap)" />
                <path d="M74 95 C72 80 66 72 62 69 L58 73 C62 77 66 84 68 95 Z" fill="url(#p-orange-strap)" />
                <path d="M43 69 L50 78 L57 69 Z" fill="#252528" />
                <path d="M44 58 L44 68 C46 70 54 70 56 68 L56 58 Z" fill="url(#p-skin-grad)" />
                <path d="M36 41 C36 60 43 64 50 64 C57 64 64 60 64 41 C64 29 58 26 50 26 C42 26 36 29 36 41 Z" fill="url(#p-skin-grad)" />
                <ellipse cx="44" cy="42.5" rx="1.8" ry="2.2" fill="#201c1c" />
                <ellipse cx="56" cy="42.5" rx="1.8" ry="2.2" fill="#201c1c" />
                <circle cx="44.5" cy="41.7" r="0.6" fill="#ffffff" />
                <circle cx="56.5" cy="41.7" r="0.6" fill="#ffffff" />
                <path d="M41 38.5 Q44 37 47 38.5" stroke="#2a2323" strokeWidth="0.9" strokeLinecap="round" fill="none" />
                <path d="M53 38.5 Q56 37 59 38.5" stroke="#2a2323" strokeWidth="0.9" strokeLinecap="round" fill="none" />
                <path d="M50 45 L49.2 47 L50.8 47" stroke="#cfa692" strokeWidth="0.6" strokeLinecap="round" fill="none" />
                <path d="M48 52 Q50 53 52 52" stroke="#bf8e78" strokeWidth="0.8" strokeLinecap="round" fill="none" />
                <path d="M33 37 C29 27 38 17 50 17 C62 17 71 27 67 37 C72 43 71 54 68 59 C66 52 65 46 64 44 C64 27 58 23 50 23 C42 23 36 27 36 44 C35 46 34 52 32 59 C29 54 28 43 33 37 Z" fill="url(#p-hair-grad)" />
                <path d="M34 31 L39 39 L40 33 L45 43 L47 34 L52 45 L54 34 L59 42 L61 33 L65 39 L63 28 C58 21 42 21 34 31 Z" fill="url(#p-hair-grad)" />
                <path d="M59 37 L62.5 45 L60.5 36 Z" fill="#e85b3a" />
              </svg>
            )}
            </div>
            <button type="button" className="profile-edit-btn" onClick={handleAvatarClick}>Edit</button>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
          </div>

          <div className="profile-saved-details">
            {savedProfile.name && <p>{savedProfile.name}</p>}
            {savedProfile.address && <p>{savedProfile.address}</p>}
            {savedProfile.email && <p>{savedProfile.email}</p>}
            {savedProfile.phone && <p>{savedProfile.phone}</p>}
          </div>
        </div>

        <div className="profile-fields-col">
          <div className="profile-field-row">
            <input
              ref={nameRef}
              className="profile-input"
              type="text"
              placeholder="Enter your name....."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="button" className="profile-next-btn" onClick={() => addressRef.current?.focus()}>Next</button>
          </div>

          <div className="profile-field-row">
            <input
              ref={addressRef}
              className="profile-input"
              type="text"
              placeholder="Enter Your address....."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <button type="button" className="profile-next-btn" onClick={() => emailRef.current?.focus()}>Next</button>
          </div>

          <div className="profile-field-row">
            <input
              ref={emailRef}
              className="profile-input"
              type="email"
              placeholder="Enter your Email Id....."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="button" className="profile-next-btn" onClick={() => phoneRef.current?.focus()}>Next</button>
          </div>

          <div className="profile-field-row">
            <input
              ref={phoneRef}
              className="profile-input"
              type="tel"
              placeholder="Enter your Phone No....."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button type="button" className="profile-next-btn" onClick={() => aboutRef.current?.focus()}>Next</button>
          </div>

          <div className="profile-field-row">
            <textarea
              ref={aboutRef}
              className="profile-textarea"
              placeholder="About....."
              value={about}
              onChange={(e) => setAbout(e.target.value)}
            />
            <button type="button" className="profile-next-btn" onClick={() => submitBtnRef.current?.focus()}>Next</button>
          </div>
        </div>
      </div>

      <div className="profile-submit-row">
        <button type="button" className="profile-submit-btn" ref={submitBtnRef} onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving...' : 'Submit New Data'}
        </button>
      </div>
    </div>
  );
}