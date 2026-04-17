const API_BASE = '../../api';

const PRODUCTS = [
  { sku: 'BEV-001', name: 'Coca Cola',    category: 'Beverages' },
  { sku: 'BEV-002', name: 'Pepsi',        category: 'Beverages' },
  { sku: 'BEV-003', name: 'Sprite',       category: 'Beverages' },
  { sku: 'BEV-004', name: 'Water',        category: 'Beverages' },
  { sku: 'BEV-005', name: 'Orange Juice', category: 'Beverages' },
  { sku: 'SNK-001', name: 'Chips',        category: 'Snacks' },
  { sku: 'SNK-002', name: 'Pretzels',     category: 'Snacks' },
  { sku: 'SNK-003', name: 'Crackers',     category: 'Snacks' },
  { sku: 'SNK-004', name: 'Popcorn',      category: 'Snacks' },
  { sku: 'CND-001', name: 'Snickers Bar', category: 'Candy' },
  { sku: 'CND-002', name: 'M&Ms',         category: 'Candy' },
  { sku: 'CND-003', name: 'Kit Kat',      category: 'Candy' },
  { sku: 'HLT-001', name: 'Granola Bar',  category: 'Healthy' },
  { sku: 'HLT-002', name: 'Trail Mix',    category: 'Healthy' },
  { sku: 'HLT-003', name: 'Fruit Cup',    category: 'Healthy' },
];

const RATING_HINTS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

let selectedRating = 0;

function getUrlParam(key) {
  return new URLSearchParams(window.location.search).get(key) ?? '';
}

function initLocation() {
  const locationInput = document.getElementById('location');
  const machineInput  = document.getElementById('machineId');

  const machine  = getUrlParam('machine');
  const location = getUrlParam('location');

  if (machine)  machineInput.value  = machine;
  if (location) locationInput.value = decodeURIComponent(location);
  else          locationInput.value = 'Unknown Location';
}

function initStarRating() {
  const stars   = document.querySelectorAll('.star-btn');
  const hidden  = document.getElementById('ratingInput');
  const hint    = document.getElementById('ratingHint');

  stars.forEach(star => {
    const val = parseInt(star.dataset.value, 10);

    star.addEventListener('mouseenter', () => highlightStars(val));
    star.addEventListener('mouseleave', () => highlightStars(selectedRating));

    star.addEventListener('click', () => {
      selectedRating   = val;
      hidden.value     = val;
      hint.textContent = RATING_HINTS[val] ?? '';
      highlightStars(val);

      document.getElementById('ratingError').classList.add('hidden');
      document.getElementById('ratingInput').classList.remove('has-error');
    });
  });
}

function highlightStars(upTo) {
  document.querySelectorAll('.star-btn').forEach(s => {
    const v = parseInt(s.dataset.value, 10);
    s.classList.toggle('selected', v <= upTo);
    s.classList.remove('hovered');
    if (v <= upTo && upTo !== selectedRating) s.classList.add('hovered');
  });
}

function initItemsGrid() {}

function initCharCounters() {
  [['comments', 'commentsCount', 1000], ['suggestions', 'suggestionsCount', 500]].forEach(([id, countId, max]) => {
    const el    = document.getElementById(id);
    const count = document.getElementById(countId);
    el.addEventListener('input', () => {
      count.textContent = `${el.value.length} / ${max}`;
    });
  });
}

function getSelectedItems() {
  const val = document.getElementById('itemsPurchased').value.trim();
  if (!val) return [];
  return val.split(',').map(s => s.trim()).filter(s => s !== '');
}

function validateForm() {
  let valid = true;

  if (!selectedRating) {
    document.getElementById('ratingError').classList.remove('hidden');
    valid = false;
  }

  const comments = document.getElementById('comments').value.trim();
  const commentsError = document.getElementById('commentsError');
  const commentsInput = document.getElementById('comments');
  if (!comments) {
    commentsError.classList.remove('hidden');
    commentsInput.classList.add('has-error');
    valid = false;
  } else {
    commentsError.classList.add('hidden');
    commentsInput.classList.remove('has-error');
  }

  return valid;
}

function setSubmitting(active) {
  const btn     = document.getElementById('submitBtn');
  const label   = document.getElementById('submitLabel');
  const spinner = document.getElementById('submitSpinner');

  btn.disabled          = active;
  label.textContent     = active ? 'Submitting...' : 'Submit Feedback';
  spinner.classList.toggle('hidden', !active);
}

async function handleSubmit(e) {
  e.preventDefault();

  if (!validateForm()) return;

  const payload = {
    machine_id:      document.getElementById('machineId').value,
    location:        document.getElementById('location').value,
    rating:          selectedRating,
    comments:        document.getElementById('comments').value.trim(),
    items_purchased: getSelectedItems(),
    suggestions:     document.getElementById('suggestions').value.trim(),
  };

  setSubmitting(true);

  try {
    const res = await fetch(`${API_BASE}/feedback/submit.php`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error ?? 'Submission failed');
    }

    document.getElementById('successSection').classList.remove('hidden');

  } catch (err) {
    alert('There was a problem submitting your feedback. Please try again.\n\n' + err.message);
  } finally {
    setSubmitting(false);
  }
}

function initSubmitAnother() {
  document.getElementById('submitAnother').addEventListener('click', () => {
    document.getElementById('feedbackForm').reset();
    selectedRating = 0;
    highlightStars(0);
    document.getElementById('ratingInput').value = '';
    document.getElementById('ratingHint').textContent = '';
    document.getElementById('commentsCount').textContent   = '0 / 1000';
    document.getElementById('suggestionsCount').textContent = '0 / 500';

    document.getElementById('feedbackForm').reset();
    document.getElementById('successSection').classList.add('hidden');
  });
}

document.getElementById('feedbackForm').addEventListener('submit', handleSubmit);

initLocation();
initStarRating();
initItemsGrid();
initCharCounters();
initSubmitAnother();
