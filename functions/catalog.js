/**
 * STARTING DATA only. The first time the website asks for the seva list, these are copied into
 * Firestore (collections `sevas` and `settings/booking`). After that, change sevas, prices and
 * dates in the admin portal (/admin/) — not here.
 */
module.exports = {
  sevas: [
    { id: 'panaka-panchamrutha', name: 'Panaka & Panchamrutha Abhisheka', kn: 'ಪಾನಕ ಮತ್ತು ಪಂಚಾಮೃತ ಅಭಿಷೇಕ', amount: 501, icon: 'water-outline' },
    { id: 'kalyanotsava-sankalpa', name: 'Kalyanotsava Sankalpa', kn: 'ಕಲ್ಯಾಣೋತ್ಸವ ಸಂಕಲ್ಪ', amount: 1001, icon: 'heart-outline' },
    { id: 'pallakki-rathotsava', name: 'Pallakki & Rathotsava', kn: 'ಪಲ್ಲಕ್ಕಿ ಮತ್ತು ರಥೋತ್ಸವ', amount: 2001, icon: 'flag-outline' },
    { id: 'pushpalankara', name: 'Pushpalankara', kn: 'ಪುಷ್ಪಾಲಂಕಾರ', amount: 2501, icon: 'flower-outline' },
    { id: 'vastra-samarpane', name: 'Vastra Samarpane', kn: 'ವಸ್ತ್ರ ಸಮರ್ಪಣೆ', amount: 5001, icon: 'shirt-outline' },
    { id: 'annasantarpane', name: 'Annasantarpane', kn: 'ಅನ್ನಸಂತರ್ಪಣೆ', amount: 10001, icon: 'restaurant-outline' },
    { id: 'sampoorna-seva', name: 'Sampoorna Seva', kn: 'ಸಂಪೂರ್ಣ ಸೇವೆ', amount: 25001, icon: 'star-outline' },
    { id: 'sampoorna-maha-seva', name: 'Sampoorna Maha Seva', kn: 'ಸಂಪೂರ್ಣ ಮಹಾ ಸೇವೆ', amount: 50001, icon: 'sparkles-outline' },
  ],
  booking: {
    open: true,
    // YYYY-MM-DD; label is shown to devotees
    dates: [{ date: '2027-02-20', label: 'Sri Madhwanavami Utsava', kn: 'ಶ್ರೀ ಮಧ್ವನವಮಿ ಉತ್ಸವ', open: true }],
    note: '',
  },
  donationPurposes: ['General donation', 'Annadana', 'Temple development', 'Medical camps', 'Education support'],
  donationMin: 1,
  donationMax: 500000,
};
