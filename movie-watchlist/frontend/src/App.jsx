import { useCallback, useEffect, useState } from 'react'
import './App.css'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '')
const GENRES = ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller']
const PLATFORMS = ['Netflix', 'Prime Video', 'Hotstar', 'Theatre', 'Other']
const STATUSES = ['To Watch', 'Watching', 'Watched']
const CURRENT_YEAR = new Date().getFullYear()
const EMPTY_FORM = {
  title: '',
  genre: 'Action',
  releaseYear: CURRENT_YEAR,
  runtime: 120,
  platform: 'Netflix',
  priority: 3,
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new Error(`Could not connect to the API at ${API_BASE}. Is the backend running?`)
  }

  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || `Request failed (${response.status})`)
  }
  return result.data
}

function validateMovie(form) {
  const year = Number(form.releaseYear)
  const runtime = Number(form.runtime)
  const priority = Number(form.priority)
  if (!form.title.trim()) return 'Title is required.'
  if (form.releaseYear !== undefined &&
      (!Number.isInteger(year) || year < 1950 || year > CURRENT_YEAR)) {
    return `Release year must be between 1950 and ${CURRENT_YEAR}.`
  }
  if (!Number.isInteger(runtime) || runtime < 30 || runtime > 300) {
    return 'Runtime must be an integer from 30 to 300 minutes.'
  }
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
    return 'Priority must be an integer from 1 to 5.'
  }
  return ''
}

function MovieForm({ editing, onCancel, onSave, saving }) {
  const [form, setForm] = useState(editing ? {
    title: editing.title,
    genre: editing.genre,
    runtime: editing.runtime,
    platform: editing.platform,
    priority: editing.priority,
  } : EMPTY_FORM)
  const [validationError, setValidationError] = useState('')

  function update(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    const error = validateMovie(form)
    if (error) {
      setValidationError(error)
      return
    }
    setValidationError('')
    const saved = await onSave({
      ...form,
      ...(editing ? {} : { releaseYear: Number(form.releaseYear) }),
      runtime: Number(form.runtime),
      priority: Number(form.priority),
    })
    if (!editing && saved) setForm(EMPTY_FORM)
  }

  return (
    <form className="movie-form" onSubmit={submit}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{editing ? 'UPDATE YOUR LIST' : 'BUILD YOUR QUEUE'}</p>
          <h2>{editing ? 'Edit movie' : 'Add a movie'}</h2>
        </div>
        {editing && <button className="text-button" type="button" onClick={onCancel}>Cancel</button>}
      </div>
      <label>
        Title
        <input name="title" value={form.title} onChange={update} maxLength="120" required />
      </label>
      <div className="form-grid">
        <label>
          Genre
          <select name="genre" value={form.genre} onChange={update}>
            {GENRES.map(genre => <option key={genre}>{genre}</option>)}
          </select>
        </label>
        {!editing && (
          <label>
            Release year
            <input name="releaseYear" type="number" min="1950" max={CURRENT_YEAR} value={form.releaseYear} onChange={update} required />
          </label>
        )}
        <label>
          Runtime (min)
          <input name="runtime" type="number" min="30" max="300" value={form.runtime} onChange={update} required />
        </label>
        <label>
          Platform
          <select name="platform" value={form.platform} onChange={update}>
            {PLATFORMS.map(platform => <option key={platform}>{platform}</option>)}
          </select>
        </label>
        <label>
          Priority (1–5)
          <select name="priority" value={form.priority} onChange={update}>
            {[1, 2, 3, 4, 5].map(priority => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </label>
      </div>
      {validationError && <p className="form-error" role="alert">{validationError}</p>}
      <button className="primary-button full-button" disabled={saving} type="submit">
        {saving ? 'Saving…' : editing ? 'Save changes' : 'Add to watchlist'}
      </button>
    </form>
  )
}

function MovieCard({ movie, onEdit, onDelete, onStatus, onRating }) {
  const transitions = {
    'To Watch': ['Watching', 'Watched'],
    Watching: ['Watched', 'To Watch'],
    Watched: [],
  }
  const [nextStatus, setNextStatus] = useState('')
  const [rating, setRating] = useState('')
  const [ratingError, setRatingError] = useState('')

  async function updateStatus() {
    if (nextStatus === 'Watched' && (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 10)) {
      setRatingError('Enter a whole-number rating from 1 to 10.')
      return
    }
    setRatingError('')
    const updated = await onStatus(movie, nextStatus, nextStatus === 'Watched' ? Number(rating) : undefined)
    if (updated !== false) {
      setNextStatus('')
      setRating('')
    }
  }

  return (
    <article className="movie-card">
      <div className="card-topline">
        <span className="movie-code">{movie.movieCode}</span>
        <span className={`status-badge ${movie.status.toLowerCase().replaceAll(' ', '-')}`}>{movie.status}</span>
      </div>
      <h3>{movie.title}</h3>
      <p className="movie-subtitle">{movie.genre} <span>·</span> {movie.releaseYear} <span>·</span> {movie.runtime} min</p>
      <div className="movie-facts">
        <span>{movie.platform}</span>
        <span className="priority">Priority {movie.priority}/5</span>
        {movie.rating != null && <span className="rating">★ {movie.rating}/10</span>}
      </div>
      {movie.watchedDate && <p className="watched-date">Watched {new Date(movie.watchedDate).toLocaleDateString()}</p>}
      <div className="card-actions">
        {movie.status !== 'Watched' && (
          <select aria-label={`Change status for ${movie.title}`} value={nextStatus} onChange={event => {
            const value = event.target.value
            setNextStatus(value)
            setRating('')
            setRatingError('')
            if (value && value !== 'Watched') {
              onStatus(movie, value)
              setNextStatus('')
            }
          }}>
            <option value="">Change status…</option>
            {transitions[movie.status].map(status => <option key={status}>{status}</option>)}
          </select>
        )}
        <button className="small-button" type="button" onClick={() => onEdit(movie)}>Edit</button>
        <button className="small-button danger-button" type="button" disabled={movie.status === 'Watching'} onClick={() => onDelete(movie)}>
          Delete
        </button>
      </div>
      {nextStatus === 'Watched' && (
        <div className="rating-entry">
          <label>
            Rating to mark watched (1–10)
            <input aria-label={`Rating for ${movie.title}`} type="number" min="1" max="10" step="1" value={rating} onChange={event => {
              setRating(event.target.value)
              setRatingError('')
            }} />
          </label>
          <button className="small-button" type="button" disabled={!rating || Number(rating) < 1 || Number(rating) > 10} onClick={updateStatus}>Save rating & mark watched</button>
          {ratingError && <p className="form-error" role="alert">{ratingError}</p>}
        </div>
      )}
      {movie.status === 'Watched' && (
        <form className="rating-entry" onSubmit={event => {
          event.preventDefault()
          setRatingError('')
          Promise.resolve(onRating(movie, Number(rating))).then(updated => {
            if (updated !== false) setRating('')
          })
        }}>
          <label>
            Change rating
            <input aria-label={`New rating for ${movie.title}`} type="number" min="1" max="10" step="1" placeholder={String(movie.rating)} value={rating} onChange={event => setRating(event.target.value)} />
          </label>
          <button className="small-button" type="submit" disabled={!rating || Number(rating) < 1 || Number(rating) > 10}>Update</button>
          {ratingError && <p className="form-error" role="alert">{ratingError}</p>}
        </form>
      )}
    </article>
  )
}

function App() {
  const [movies, setMovies] = useState([])
  const [stats, setStats] = useState(null)
  const [filters, setFilters] = useState({ status: '', genre: '', title: '' })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalMovies, setTotalMovies] = useState(0)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [nextPick, setNextPick] = useState(null)

  const loadDashboard = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '6' })
    if (filters.status) params.set('status', filters.status)
    if (filters.genre) params.set('genre', filters.genre)
    if (filters.title.trim()) params.set('title', filters.title.trim())
    const [listing, statistics] = await Promise.all([
      request(`/movies?${params}`),
      request('/movies/stats'),
    ])
    return { listing, statistics }
  }, [filters, page])

  const refresh = useCallback(async () => {
    const { listing, statistics } = await loadDashboard()
    setMovies(listing.movies)
    setTotalPages(Math.max(1, listing.totalPages))
    setTotalMovies(listing.totalMovies)
    setStats(statistics)
  }, [loadDashboard])

  useEffect(() => {
    let active = true
    loadDashboard()
      .then(({ listing, statistics }) => {
        if (active) {
          setMovies(listing.movies)
          setTotalPages(Math.max(1, listing.totalPages))
          setTotalMovies(listing.totalMovies)
          setStats(statistics)
          setError('')
        }
      })
      .catch(problem => {
        if (active) setError(problem.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [loadDashboard])

  async function perform(action, message) {
    setError('')
    setNotice('')
    try {
      setSaving(true)
      await action()
      setEditing(null)
      setNextPick(null)
      await refresh()
      setNotice(message)
      return true
    } catch (problem) {
      setError(problem.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  function saveMovie(form) {
    return perform(
      () => request(editing ? `/movies/${editing._id}` : '/movies', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      }),
      editing ? 'Movie updated.' : 'Movie added to your watchlist.',
    )
  }

  function changeStatus(movie, status, rating) {
    return perform(() => request(`/movies/${movie._id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...(rating === undefined ? {} : { rating }) }),
    }), `Status updated to ${status}.`)
  }

  function changeRating(movie, rating) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      setError('Rating must be an integer from 1 to 10.')
      return Promise.resolve()
    }
    return perform(() => request(`/movies/${movie._id}/rating`, {
      method: 'PATCH',
      body: JSON.stringify({ rating }),
    }), 'Rating updated.')
  }

  function deleteMovie(movie) {
    if (!window.confirm(`Delete "${movie.title}" from your watchlist?`)) return
    return perform(() => request(`/movies/${movie._id}`, { method: 'DELETE' }), 'Movie deleted.')
  }

  async function findNext() {
    setError('')
    setNotice('')
    try {
      setNextPick(await request('/movies/watch-next'))
    } catch (problem) {
      setNextPick(null)
      setError(problem.message)
    }
  }

  function updateFilter(event) {
    setLoading(true)
    setFilters(current => ({ ...current, [event.target.name]: event.target.value }))
    setPage(1)
  }

  function changePage(nextPage) {
    setLoading(true)
    setPage(nextPage)
  }

  return (
    <main className="app-shell">
      <header className="hero-header">
        <div className="brand-mark">FRAME<span>BY</span>FRAME</div>
        <p className="eyebrow">YOUR PERSONAL CINEMA JOURNAL</p>
        <h1>Every great movie<br /><em>starts on your list.</em></h1>
        <p className="hero-copy">Keep your next favorite close. Organize what to watch, track what you’ve seen, and make every movie night count.</p>
        <button className="hero-button" type="button" onClick={findNext}>What should I watch next? <span>↗</span></button>
        {nextPick && (
          <div className="next-pick" role="status">
            <span className="eyebrow">TONIGHT'S PICK · PRIORITY {nextPick.priority}</span>
            <strong>{nextPick.title}</strong>
            <span>{nextPick.genre} · {nextPick.runtime} min · {nextPick.platform}</span>
          </div>
        )}
      </header>

      <section className="stats-row" aria-label="Watchlist statistics">
        <div className="stat-item"><span>IN YOUR QUEUE</span><strong>{stats?.statusCounts?.['To Watch'] ?? '—'}</strong></div>
        <div className="stat-item"><span>IN PROGRESS</span><strong>{stats?.statusCounts?.Watching ?? '—'}</strong></div>
        <div className="stat-item"><span>MOVIES WATCHED</span><strong>{stats?.statusCounts?.Watched ?? '—'}</strong></div>
        <div className="stat-item"><span>HOURS WATCHED</span><strong>{stats?.totalHoursWatched ?? '—'}</strong></div>
        <div className="stat-item"><span>AVG. RATING</span><strong>{stats ? `${stats.averageRating}/10` : '—'}</strong></div>
        <div className="stat-item"><span>TOP GENRE</span><strong className="stat-genre">{stats?.topWatchedGenre || '—'}</strong></div>
      </section>

      {(error || notice) && <div className={error ? 'message error-message' : 'message success-message'} role={error ? 'alert' : 'status'}>{error || notice}</div>}

      <section className="workspace">
        <aside className="sidebar">
          <MovieForm
            key={editing?._id || 'new-movie'}
            editing={editing}
            onCancel={() => setEditing(null)}
            onSave={saveMovie}
            saving={saving}
          />
          <div className="genre-note">
            <span className="eyebrow">YOUR MOVIE DNA</span>
            <p>Most watched genre</p>
            <strong>{stats?.topWatchedGenre || 'Discover yours'}</strong>
            <span>{stats?.topWatchedGenre ? 'Your current favorite lane.' : 'Rate a watched movie to get started.'}</span>
          </div>
        </aside>

        <section className="watchlist">
          <div className="watchlist-heading">
            <div>
              <p className="eyebrow">THE COLLECTION</p>
              <h2>Your watchlist <span>{totalMovies}</span></h2>
            </div>
          </div>
          <div className="filters">
            <input name="title" aria-label="Search movie titles" placeholder="Search titles…" value={filters.title} onChange={updateFilter} />
            <select name="status" aria-label="Filter by status" value={filters.status} onChange={updateFilter}>
              <option value="">All statuses</option>
              {STATUSES.map(status => <option key={status}>{status}</option>)}
            </select>
            <select name="genre" aria-label="Filter by genre" value={filters.genre} onChange={updateFilter}>
              <option value="">All genres</option>
              {GENRES.map(genre => <option key={genre}>{genre}</option>)}
            </select>
          </div>
          {loading ? <p className="empty-state">Loading your movies…</p> : movies.length === 0 ? (
            <p className="empty-state">{error ? 'The watchlist could not be loaded.' : 'No movies match yet. Add one to get started.'}</p>
          ) : (
            <div className="movie-grid">
              {movies.map(movie => (
                <MovieCard key={movie._id} movie={movie} onEdit={setEditing} onDelete={deleteMovie} onStatus={changeStatus} onRating={changeRating} />
              ))}
            </div>
          )}
          <nav className="pagination" aria-label="Movie pages">
            <button type="button" className="small-button" disabled={page <= 1 || loading} onClick={() => changePage(page - 1)}>← Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" className="small-button" disabled={page >= totalPages || loading} onClick={() => changePage(page + 1)}>Next →</button>
          </nav>
        </section>
      </section>
      <footer>FRAME BY FRAME <span>·</span> MADE FOR YOUR NEXT MOVIE NIGHT</footer>
    </main>
  )
}

export default App
