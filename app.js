// ---- Supabase client ----
var supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
var currentUser = null;
var currentProfile = null;

// ---- Shared nav + footer ----
function renderChrome() {
  var nav = document.getElementById('site-nav');
  var footer = document.getElementById('site-footer');
  if (nav) {
    var authLink = currentUser
      ? '<a href="#" id="logout-link">Log out</a>'
      : '<a href="/login">Login</a>';
    var cta = currentUser
      ? '<a href="/browse" class="site-nav__cta">Browse</a>'
      : '<a href="/login" class="site-nav__cta">Get started</a>';
    nav.innerHTML =
      '<div class="container">' +
        '<a href="/" class="site-nav__brand">Iru Manam</a>' +
        '<div class="site-nav__links">' +
          '<a href="/">Home</a>' +
          '<a href="/browse">Browse profiles</a>' +
          authLink +
        '</div>' +
        cta +
      '</div>';
    var logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
      logoutLink.addEventListener('click', async function (e) {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.href = '/';
      });
    }
  }
  if (footer) {
    footer.innerHTML =
      '<div class="container">&copy; ' + new Date().getFullYear() + ' Iru Manam &middot; Built with Supabase</div>';
  }
}

function initials(name) {
  return name.split(' ').map(function (p) { return p[0]; }).slice(0, 2).join('');
}

// ---- Browse page ----
async function renderBrowse() {
  var grid = document.getElementById('profile-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="empty-state">Loading profiles&hellip;</div>';

  var religionFilter = document.getElementById('filter-religion');
  var genderFilter = document.getElementById('filter-gender');
  var searchInput = document.getElementById('filter-search');

  var allProfiles = [];

  async function loadProfiles() {
    var query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
    var religion = religionFilter ? religionFilter.value : '';
    var gender = genderFilter ? genderFilter.value : '';
    if (religion) query = query.eq('religion', religion);
    if (gender) query = query.eq('gender', gender);

    var { data, error } = await query;
    if (error) {
      grid.innerHTML = '<div class="empty-state">Could not load profiles: ' + error.message + '</div>';
      return;
    }
    allProfiles = data || [];
    draw();
  }

  function draw() {
    var search = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var results = allProfiles.filter(function (p) {
      if (search && p.location.toLowerCase().indexOf(search) === -1 && p.profession.toLowerCase().indexOf(search) === -1) return false;
      return true;
    });

    if (results.length === 0) {
      grid.innerHTML = '<div class="empty-state">No profiles match those filters yet.</div>';
      return;
    }

    grid.innerHTML = results.map(function (p) {
      return (
        '<div class="profile-card">' +
          '<div class="profile-card__avatar">' + initials(p.name) + '</div>' +
          '<h3>' + p.name + ', ' + p.age + '</h3>' +
          '<p class="meta">' + p.profession + ' &middot; ' + p.location + '</p>' +
          '<a class="btn btn--outline" href="/profile?id=' + p.id + '">View profile</a>' +
        '</div>'
      );
    }).join('');
  }

  [religionFilter, genderFilter].forEach(function (el) { if (el) el.addEventListener('change', loadProfiles); });
  if (searchInput) searchInput.addEventListener('input', draw);

  await loadProfiles();
}

// ---- Profile detail page ----
async function renderProfileDetail() {
  var root = document.getElementById('profile-detail');
  if (!root) return;

  root.innerHTML = '<div class="empty-state">Loading&hellip;</div>';

  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');

  var { data: profile, error } = await supabase.from('profiles').select('*').eq('id', id).single();

  if (error || !profile) {
    root.innerHTML = '<div class="empty-state">Profile not found. <a href="/browse">Back to browse</a></div>';
    return;
  }

  var isOwnProfile = currentUser && currentUser.id === profile.id;

  root.innerHTML =
    '<div>' +
      '<div class="profile-detail__avatar">' + initials(profile.name) + '</div>' +
    '</div>' +
    '<div>' +
      '<h1>' + profile.name + '</h1>' +
      '<p class="location">' + profile.location + '</p>' +
      '<dl class="fact-grid">' +
        '<div><dt>Age</dt><dd>' + profile.age + '</dd></div>' +
        '<div><dt>Height</dt><dd>' + profile.height + '</dd></div>' +
        '<div><dt>Religion</dt><dd>' + profile.religion + '</dd></div>' +
        '<div><dt>Profession</dt><dd>' + profile.profession + '</dd></div>' +
        '<div><dt>Education</dt><dd>' + profile.education + '</dd></div>' +
        '<div><dt>Location</dt><dd>' + profile.location + '</dd></div>' +
      '</dl>' +
      '<div class="profile-detail__about">' +
        '<h3>About</h3>' +
        '<p>' + profile.about + '</p>' +
      '</div>' +
      (isOwnProfile ? '' : '<button class="btn" id="express-interest">Express interest</button>');

  var btn = document.getElementById('express-interest');
  if (btn) {
    btn.addEventListener('click', async function () {
      if (!currentUser) {
        showToast('Log in to express interest');
        window.location.href = '/login';
        return;
      }
      var { error } = await supabase.from('interests').insert({
        from_profile: currentUser.id,
        to_profile: profile.id
      });
      if (error) {
        // unique constraint => already sent
        if (error.code === '23505') {
          showToast('You already expressed interest in ' + profile.name);
        } else {
          showToast('Could not send interest: ' + error.message);
        }
      } else {
        showToast('Interest sent to ' + profile.name);
      }
    });
  }
}

// ---- Login / signup page ----
function renderAuth() {
  var tabs = document.querySelectorAll('.auth-tabs button');
  var loginForm = document.getElementById('login-form');
  var signupForm = document.getElementById('signup-form');
  if (!tabs.length) return;

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var target = tab.getAttribute('data-target');
      loginForm.style.display = target === 'login' ? 'block' : 'none';
      signupForm.style.display = target === 'signup' ? 'block' : 'none';
    });
  });

  function markInvalid(form) {
    var valid = true;
    form.querySelectorAll('[required]').forEach(function (field) {
      var errorEl = field.parentElement.querySelector('.form-error');
      if (!field.value.trim()) {
        valid = false;
        if (errorEl) errorEl.classList.add('visible');
      } else if (errorEl) {
        errorEl.classList.remove('visible');
      }
    });
    return valid;
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!markInvalid(loginForm)) return;
      var email = document.getElementById('login-email').value.trim();
      var password = document.getElementById('login-password').value;
      var submitBtn = loginForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      var { error } = await supabase.auth.signInWithPassword({ email: email, password: password });
      submitBtn.disabled = false;
      if (error) {
        showToast(error.message);
        return;
      }
      window.location.href = '/browse';
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!markInvalid(signupForm)) return;

      var name = document.getElementById('signup-name').value.trim();
      var email = document.getElementById('signup-email').value.trim();
      var gender = document.getElementById('signup-gender').value;
      var password = document.getElementById('signup-password').value;
      var age = parseInt(document.getElementById('signup-age').value, 10);
      var religion = document.getElementById('signup-religion').value;
      var location = document.getElementById('signup-location').value.trim();
      var profession = document.getElementById('signup-profession').value.trim();
      var education = document.getElementById('signup-education').value.trim();
      var height = document.getElementById('signup-height').value.trim();
      var about = document.getElementById('signup-about').value.trim();

      var submitBtn = signupForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      var { data, error } = await supabase.auth.signUp({ email: email, password: password });
      if (error) {
        submitBtn.disabled = false;
        showToast(error.message);
        return;
      }

      var userId = data.user ? data.user.id : (data.session ? data.session.user.id : null);
      if (!userId) {
        submitBtn.disabled = false;
        showToast('Check your email to confirm your account, then log in.');
        return;
      }

      var { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        name: name,
        age: age,
        gender: gender,
        religion: religion,
        location: location,
        profession: profession,
        education: education,
        height: height,
        about: about
      });

      submitBtn.disabled = false;

      if (profileError) {
        showToast('Account created, but profile save failed: ' + profileError.message);
        return;
      }

      if (data.session) {
        window.location.href = '/browse';
      } else {
        showToast('Check your email to confirm your account, then log in.');
      }
    });
  }
}

// ---- Toast ----
function showToast(message) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(function () { toast.classList.remove('visible'); }, 2600);
}

document.addEventListener('DOMContentLoaded', async function () {
  var { data } = await supabase.auth.getSession();
  currentUser = data && data.session ? data.session.user : null;

  renderChrome();
  renderBrowse();
  renderProfileDetail();
  renderAuth();
});
