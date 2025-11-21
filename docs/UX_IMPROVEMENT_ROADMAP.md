# UX Improvement Roadmap

> **Document Purpose**: Comprehensive analysis of user experience gaps and detailed improvement recommendations for the entire LenQuant platform. This document covers all 16 major pages including Dashboard, Portfolio, Terminal, Analytics (Forecasts, Strategies, Evolution, Learning Insights), Knowledge Base, Model Registry, Reports, Risk Dashboard, Assistant, and Settings. Focuses on creating intuitive user journeys, proactive guidance, actionable insights, and clear next-step indicators throughout the application.

**Created**: November 21, 2024  
**Last Updated**: November 21, 2024  
**Status**: Planning Phase - Ready for Implementation  
**Priority**: High - Foundational UX improvements  
**Scope**: 16 pages, 50+ components, 7 implementation phases, 10-week timeline

---


### Phase 7: Polish, Risk, Reports & Cross-Page Integration 
**DIVIDED INTO 4 SUB-PHASES FOR COMPLETE IMPLEMENTATION**

> **Implementation Note**: These phases build upon existing infrastructure. All components leverage the established API patterns, repository architecture, and notification system. No mock data or placeholders - every feature integrates with real backend services.

---

## Phase 7.1: UI/UX Polish & Animation System

**Timeline**: 1.5 weeks  
**Goal**: Implement comprehensive animation and loading states across the platform for smooth, professional user experience

### Backend Tasks

#### 1. API Response Time Tracking
**Files to Create**:
- `api/middleware/performance_tracking.py`
  - Request duration logging middleware
  - Endpoint performance metrics collection
  - Slow query detection (>500ms warning, >2s error)
  - Store metrics in `api_performance_metrics` collection

**Files to Modify**:
- `api/main.py`
  - Add performance tracking middleware
  - Add response time headers (X-Response-Time)

**Database Schema**:
```
Collection: api_performance_metrics
{
  endpoint: str,
  method: str,
  duration_ms: float,
  status_code: int,
  user_id: str,
  timestamp: datetime,
  slow_query: bool
}
```

#### 2. Batch Operations API
**Files to Create**:
- `api/routes/batch_operations.py`
  - POST /api/batch/forecasts - Batch forecast requests
  - POST /api/batch/models - Batch model info requests
  - POST /api/batch/strategies - Batch strategy data
  - Returns: Aggregated data with single response

**Purpose**: Reduce multiple API calls during page loads, improving animation smoothness

### Frontend Tasks

#### 1. Animation System Foundation
**Files to Create**:
- `web/next-app/lib/animations.ts`
  - Framer Motion variants library
  - Standard animation durations (fast: 150ms, normal: 250ms, slow: 350ms)
  - Easing curves (ease-out for entries, ease-in-out for transitions)
  - Page transition configurations
  - Stagger animation helpers

- `web/next-app/components/transitions/PageTransition.tsx`
  - Wrapper component for page-level animations
  - Fade + slide transitions
  - Loading state during route changes
  - Progress bar at top of page

- `web/next-app/components/transitions/FadeIn.tsx`
  - Generic fade-in wrapper component
  - Configurable delay, duration, direction
  - Intersection Observer for scroll-triggered animations

- `web/next-app/components/transitions/SlideIn.tsx`
  - Slide animation component (top, bottom, left, right)
  - Used for modals, drawers, notifications

#### 2. Loading Skeletons
**Files to Create**:
- `web/next-app/components/skeletons/CardSkeleton.tsx`
  - Generic card loading skeleton
  - Pulsing animation effect
  - Matches card component dimensions

- `web/next-app/components/skeletons/TableSkeleton.tsx`
  - Table row skeletons with configurable column count
  - Shimmer effect across rows

- `web/next-app/components/skeletons/ChartSkeleton.tsx`
  - Chart area placeholder
  - Animated axis lines and grid

- `web/next-app/components/skeletons/ForecastSkeleton.tsx`
  - Specific to forecast cards
  - Shows symbol, metrics placeholders

- `web/next-app/components/skeletons/StrategySkeleton.tsx`
  - Strategy card loading state

**Files to Modify**:
- `pages/forecasts/index.tsx`
  - Replace "Loading..." with ForecastSkeleton (3-5 cards)
  - Implement SWR for data fetching with loading states

- `pages/analytics/StrategiesTab.tsx`
  - Add StrategySkeleton during data loads
  - Skeleton count matches expected results (10)

- `pages/models/registry/index.tsx`
  - Add TableSkeleton (8 rows) while loading models
  - Smooth transition from skeleton to real data

- `pages/terminal.tsx`
  - Add ChartSkeleton for candlestick chart area
  - CardSkeleton for market metrics

- `pages/portfolio.tsx`
  - CardSkeleton for position cards
  - TableSkeleton for transaction history

#### 3. Success Animations & Micro-interactions
**Files to Create**:
- `web/next-app/components/feedback/SuccessAnimation.tsx`
  - Checkmark animation (scale + fade)
  - Confetti burst for major actions
  - Auto-dismiss after 2 seconds

- `web/next-app/components/feedback/LoadingDots.tsx`
  - Three-dot bounce animation
  - Used in buttons during async operations

- `web/next-app/components/feedback/ProgressRing.tsx`
  - Circular progress indicator
  - Animates from 0-100%
  - Shows completion percentage

**Files to Modify**:
- `pages/terminal.tsx`
  - Add success animation after order placement
  - Pulse effect on price updates
  - Hover scale on action buttons

- `pages/settings/DataIngestionTab.tsx`
  - Success animation when data ingestion completes
  - Loading dots in "Fetch Data" button
  - Progress ring for ongoing ingestion jobs

- `components/NotificationCenter.tsx`
  - Slide-in animation for new notifications
  - Badge pulse when unread count increases
  - Smooth expand/collapse panel

#### 4. Button & Interactive Element Micro-interactions
**Files to Create**:
- `web/next-app/components/ui/AnimatedButton.tsx`
  - Extends base Button component
  - Hover: scale(1.02) + shadow increase
  - Active: scale(0.98)
  - Disabled: opacity + cursor changes
  - Loading state with spinner

**Files to Modify**:
- `pages/analytics/EvolutionTab.tsx`
  - Animate "Start Evolution" button on hover
  - Ripple effect on click
  - Success checkmark when evolution completes

- `pages/assistant/index.tsx`
  - Typing indicator animation while AI responds
  - Message slide-in animations
  - Smooth scroll to new messages

### Integration Points

1. **Layout.tsx Enhancement**:
   - Wrap {children} with PageTransition
   - Add page-level loading state
   - Implement route change progress bar

2. **Global Loading State**:
   - Create usePageLoading hook
   - Track router events (routeChangeStart, routeChangeComplete)
   - Show/hide progress bar

3. **API Integration**:
   - All data fetches use SWR or React Query
   - Automatic loading states
   - Error boundaries with animations

### Testing Checklist

- [ ] All page transitions smooth (no flash of content)
- [ ] Skeletons match final content dimensions
- [ ] No layout shift during load-to-content transition
- [ ] Success animations don't block UI
- [ ] Animations respect prefers-reduced-motion
- [ ] Loading states appear after 300ms delay (avoid flicker)
- [ ] Micro-interactions feel responsive (<100ms feedback)
- [ ] No animation jank (maintain 60fps)

### Dependencies to Add

**package.json additions**:
```json
{
  "framer-motion": "^10.16.4",
  "react-intersection-observer": "^9.5.3"
}
```

---

## Phase 7.2: Unified Search & Activity Feed System

**Timeline**: 2 weeks  
**Goal**: Implement global search across all entities and real-time activity tracking

### Backend Tasks

#### 1. Unified Search Service
**Files to Create**:
- `search/search_engine.py`
  - SearchEngine class with index_document(), search() methods
  - Multi-collection search (models, strategies, forecasts, symbols, knowledge)
  - Relevance scoring algorithm
  - Fuzzy matching for typos
  - Search history tracking

**Database Schema**:
```
Collection: search_index
{
  entity_type: str,  # "model", "strategy", "forecast", "symbol", "knowledge"
  entity_id: str,
  title: str,
  description: str,
  keywords: [str],
  metadata: dict,
  created_at: datetime,
  updated_at: datetime
}

Collection: search_history
{
  user_id: str,
  query: str,
  results_count: int,
  selected_result: str (optional),
  timestamp: datetime
}
```

**Files to Create**:
- `api/routes/search.py`
  - GET /api/search?q={query}&types={entity_types}&limit={n}
  - Returns: Ranked results with highlights
  - POST /api/search/index - Re-index all searchable entities
  - GET /api/search/suggestions?q={partial} - Autocomplete
  - GET /api/search/recent - User's recent searches

**Search Indexing Logic**:
- Models: Index by symbol, horizon, algorithm, trained_at
- Strategies: Index by ID, symbol, metrics (sharpe, win_rate)
- Forecasts: Index by symbol, horizon, confidence
- Knowledge: Index by title, content, tags
- Symbols: Index by name, pair, exchange

**Response Format**:
```json
{
  "query": "BTC sharpe",
  "results": [
    {
      "type": "strategy",
      "id": "strat_123",
      "title": "BTC/USD High-Sharpe Strategy",
      "description": "Sharpe: 2.4, Active",
      "url": "/analytics#strategies",
      "highlights": ["<mark>BTC</mark>/USD", "<mark>Sharpe</mark>: 2.4"],
      "relevance_score": 0.95
    }
  ],
  "total_count": 12,
  "search_time_ms": 45
}
```

#### 2. Activity Tracking System
**Files to Create**:
- `monitor/activity_tracker.py`
  - ActivityTracker class
  - track_activity(user_id, action_type, entity_type, entity_id, metadata)
  - get_recent_activity(user_id, limit, types_filter)
  - Activity types: "view", "create", "update", "delete", "execute"

**Database Schema**:
```
Collection: user_activity
{
  user_id: str,
  action_type: str,  # "view", "create", "update", "delete", "execute"
  entity_type: str,  # "model", "strategy", "forecast", "trade", "report"
  entity_id: str,
  entity_name: str,
  metadata: dict,
  timestamp: datetime
}

Indexes:
- user_id + timestamp (descending)
- entity_type + entity_id
```

**Files to Create**:
- `api/routes/activity.py`
  - GET /api/activity/recent?limit={n}&types={filter}
  - GET /api/activity/timeline?start={date}&end={date}
  - POST /api/activity/track - Record activity event
  - GET /api/activity/stats - Activity statistics (daily, weekly)

**Activity Response Format**:
```json
{
  "activities": [
    {
      "id": "act_123",
      "action_type": "execute",
      "entity_type": "trade",
      "entity_name": "BTC/USD Buy Order",
      "description": "Placed buy order for BTC/USD at $45,123",
      "url": "/terminal?order=ord_456",
      "timestamp": "2024-11-21T10:30:00Z",
      "metadata": {
        "symbol": "BTC/USD",
        "side": "buy",
        "price": 45123
      }
    }
  ],
  "has_more": true
}
```

#### 3. Activity Middleware Integration
**Files to Modify**:
- `api/routes/forecast.py`
  - Track "view" activity when GET /forecasts called
  - Track "create" when forecast requested

- `api/routes/models.py`
  - Track "view" when model registry accessed
  - Track "create" when retrain triggered

- `api/routes/trade.py`
  - Track "execute" when order placed
  - Track "update" when order modified

- `api/routes/strategies.py`
  - Track "view" when strategy details accessed

- `api/routes/knowledge.py`
  - Track "view" when knowledge article opened

### Frontend Tasks

#### 1. Global Search Component
**Files to Create**:
- `web/next-app/components/search/GlobalSearch.tsx`
  - Keyboard shortcut trigger (Cmd+K / Ctrl+K)
  - Modal overlay with search input
  - Real-time search as you type (debounced 300ms)
  - Results grouped by entity type
  - Keyboard navigation (arrow keys, enter to select)
  - Recent searches section
  - Empty state with suggestions

- `web/next-app/components/search/SearchResult.tsx`
  - Individual result item component
  - Icon based on entity_type
  - Title with highlighted query match
  - Description/preview text
  - Click navigates to entity page

- `web/next-app/components/search/SearchFilters.tsx`
  - Filter checkboxes (Models, Strategies, Forecasts, Knowledge, Symbols)
  - Clear filters button

- `web/next-app/hooks/useSearch.ts`
  - Manages search state
  - Debounced API calls
  - Keyboard shortcut listener
  - Search history management

**Search UX Flow**:
1. User presses Cmd+K → Modal opens with focus on input
2. User types "btc" → Shows recent searches, popular results
3. After 300ms → API call to /api/search?q=btc
4. Results appear grouped (3 strategies, 2 models, 1 forecast)
5. User arrows down, presses Enter → Navigate to selected result
6. Modal closes, URL updates, activity tracked

**Files to Modify**:
- `components/Layout.tsx`
  - Add GlobalSearch component to header
  - Search icon button next to notifications
  - Register keyboard shortcut

#### 2. Recent Activity Feed
**Files to Create**:
- `web/next-app/components/activity/ActivityFeed.tsx`
  - Scrollable feed of recent activities
  - Groups by date (Today, Yesterday, This Week)
  - Activity item with icon, description, timestamp
  - "Load more" button for pagination
  - Real-time updates via WebSocket

- `web/next-app/components/activity/ActivityItem.tsx`
  - Single activity entry
  - Icon based on action_type (eye for view, plus for create, etc.)
  - Entity type badge
  - Clickable link to entity
  - Relative timestamp (2 minutes ago, 1 hour ago)

- `web/next-app/components/activity/ActivityDrawer.tsx`
  - Slide-in drawer from right side
  - Toggle button in header
  - Filters: All, Trades, Models, Strategies
  - Activity statistics at top (trades today, models trained this week)

- `web/next-app/hooks/useActivity.ts`
  - Fetch activity feed from API
  - Real-time updates via WebSocket
  - Pagination support
  - Filter management

**Files to Create**:
- `web/next-app/hooks/useActivitySocket.ts`
  - WebSocket connection to /ws/activity
  - Receives real-time activity events
  - Prepends new activities to feed
  - Connection state management

**Files to Modify**:
- `components/Layout.tsx`
  - Add activity drawer toggle button
  - Activity icon with badge (number of new activities)
  - Manage drawer open/close state

- `pages/index.tsx` (Dashboard)
  - Add "Recent Activity" section
  - Show last 5 activities
  - "View All" link opens activity drawer

#### 3. Search Quick Actions
**Files to Create**:
- `web/next-app/components/search/QuickActions.tsx`
  - Pre-defined search shortcuts
  - "High Confidence Forecasts" → Searches forecasts >0.8 confidence
  - "Top Strategies" → Searches strategies by sharpe
  - "Recent Models" → Searches models trained <7 days
  - Click executes search with pre-set filters

### Integration Points

#### 1. Search Integration with Existing Pages
**Files to Modify**:
- `pages/forecasts/index.tsx`
  - Add search bar at top (uses GlobalSearch component)
  - Quick filters: Symbol, Confidence, Horizon
  - Search within forecasts

- `pages/models/registry/index.tsx`
  - Search by symbol, horizon, algorithm
  - Filter by health status (fresh, aging, stale)

- `pages/analytics/StrategiesTab.tsx`
  - Search by symbol, strategy ID
  - Sort/filter by metrics

- `pages/knowledge/index.tsx`
  - Full-text search in articles
  - Tag-based filtering

#### 2. Activity Tracking Integration
**Create Helper**:
- `web/next-app/lib/track-activity.ts`
  - trackActivity(action, entity_type, entity_id, metadata)
  - Called on user actions throughout app

**Files to Modify** (Add tracking):
- `pages/terminal.tsx` - Track symbol views, order placements
- `pages/forecasts/index.tsx` - Track forecast views
- `pages/models/registry/index.tsx` - Track model detail views
- `pages/analytics/StrategiesTab.tsx` - Track strategy views
- `pages/assistant/index.tsx` - Track queries, evidence views

#### 3. WebSocket Extensions
**Files to Modify**:
- `api/main.py`
  - Add /ws/activity endpoint
  - Broadcast activity events to user's connections
  - Activity filtering by user_id

### Testing Checklist

- [ ] Search opens with Cmd+K on Mac, Ctrl+K on Windows
- [ ] Search input has autofocus when modal opens
- [ ] Search results update within 300ms of typing
- [ ] Keyboard navigation works (arrows, enter, escape)
- [ ] Clicking result navigates correctly
- [ ] Recent searches persist across sessions
- [ ] Activity feed shows real-time updates
- [ ] Activity drawer opens/closes smoothly
- [ ] Activity links navigate to correct entities
- [ ] Search handles special characters, quotes
- [ ] Empty search shows suggestions
- [ ] Search results show relevance score visually
- [ ] Activity feed loads more on scroll

### Dependencies to Add

**package.json additions**:
```json
{
  "fuse.js": "^7.0.0",  // Client-side fuzzy search fallback
  "use-debounce": "^10.0.0"
}
```

---

## Phase 7.3: Cross-Page Navigation & Contextual Linking

**Timeline**: 2 weeks  
**Goal**: Connect all pages with intelligent contextual links and breadcrumb navigation

### Backend Tasks

#### 1. Entity Relationship Mapping
**Files to Create**:
- `db/repositories/entity_relationships_repository.py`
  - get_related_entities(entity_type, entity_id)
  - Returns: Related forecasts, models, strategies, trades, knowledge articles
  - Uses existing references in documents

**Relationship Logic**:
- **Forecast** → Related: Model (produced forecast), Strategy (using symbol), Trades (same symbol), Terminal view
- **Model** → Related: Forecasts (produced), Training run, Symbol data, Strategies using model
- **Strategy** → Related: Models, Forecasts (same symbol), Evolution runs, Trades executed
- **Trade** → Related: Forecast (if forecast-driven), Strategy, Terminal, Portfolio position
- **Knowledge Article** → Related: Strategies (mentioned symbols), Forecasts, Models
- **Risk Breach** → Related: Trade, Portfolio position, Strategy
- **Overfit Alert** → Related: Model, Evolution run, Learning job

**Files to Create**:
- `api/routes/relationships.py`
  - GET /api/relationships/{entity_type}/{entity_id}
  - Returns: Related entities with link URLs
  - Includes relationship type (produced_by, used_in, related_to)

**Response Format**:
```json
{
  "entity_type": "forecast",
  "entity_id": "fc_123",
  "relationships": [
    {
      "type": "produced_by",
      "entity_type": "model",
      "entity_id": "model_456",
      "entity_name": "BTC_USD_1h_rf_v3",
      "url": "/models/registry/model_456",
      "metadata": {"trained_at": "2024-11-20T10:00:00Z"}
    },
    {
      "type": "view_in",
      "entity_type": "terminal",
      "url": "/terminal?symbol=BTC/USD&highlight=forecast_fc_123",
      "label": "View in Terminal"
    }
  ]
}
```

#### 2. Breadcrumb Navigation Data
**Files to Create**:
- `api/routes/navigation.py`
  - GET /api/navigation/breadcrumb?path={current_path}
  - Returns: Breadcrumb trail based on URL
  - Includes parent pages and entity hierarchy

**Breadcrumb Logic**:
- `/analytics` → Dashboard / Analytics
- `/analytics?tab=strategies` → Dashboard / Analytics / Strategies
- `/models/registry/model_123` → Dashboard / Models / Registry / BTC_USD_1h_rf
- `/forecasts?symbol=BTC/USD` → Dashboard / Forecasts / BTC/USD
- `/assistant/evidence/ev_456` → Dashboard / Assistant / Evidence / {evidence_title}

**Response Format**:
```json
{
  "breadcrumbs": [
    {"label": "Dashboard", "url": "/"},
    {"label": "Analytics", "url": "/analytics"},
    {"label": "Strategies", "url": "/analytics?tab=strategies"},
    {"label": "strat_BTC_USD_001", "url": null}  // current page, no link
  ]
}
```

### Frontend Tasks

#### 1. Breadcrumb Component System
**Files to Create**:
- `web/next-app/components/navigation/Breadcrumbs.tsx`
  - Horizontal breadcrumb trail
  - Separator icons (chevron-right)
  - Links for all except last crumb (current page)
  - Truncation for long paths (show first 2, last 2, ... in middle)
  - Responsive: collapse to dropdown on mobile

- `web/next-app/hooks/useBreadcrumbs.ts`
  - Generates breadcrumbs from current route
  - Maps URL to user-friendly labels
  - Handles dynamic routes ([id], [date])

**Files to Modify**:
- `components/Layout.tsx`
  - Add Breadcrumbs component below header
  - Show on all pages except login, dashboard
  - Sticky positioning

**Breadcrumb Styles**:
- Font: text-sm text-muted-foreground
- Current page: text-foreground font-medium
- Hover: text-foreground transition
- Max width: truncate with tooltip on hover

#### 2. Contextual Link Components
**Files to Create**:
- `web/next-app/components/links/ForecastLinks.tsx`
  - "View in Terminal" button
  - "View Model Details" link
  - "Related Strategies" expandable section

- `web/next-app/components/links/ModelLinks.tsx`
  - "View Forecasts" button → /forecasts?model_id={id}
  - "View Training Data" → /analytics?tab=learning&model={id}
  - "Retrain Model" action button

- `web/next-app/components/links/StrategyLinks.tsx`
  - "View in Evolution" → /analytics?tab=evolution&strategy={id}
  - "View Trades" → /portfolio?strategy={id}
  - "View Forecasts" → /forecasts?symbol={strategy.symbol}

- `web/next-app/components/links/RiskBreachLinks.tsx`
  - "View Portfolio Position" → /portfolio?highlight={position_id}
  - "View Trade" → /terminal?order={order_id}
  - "View Strategy" → /analytics?tab=strategies&id={strategy_id}

- `web/next-app/components/links/OverfitAlertLinks.tsx`
  - "View Model" → /models/registry/{model_id}
  - "View Evolution Run" → /analytics?tab=evolution&run={run_id}
  - "View Learning Job" → /analytics?tab=learning&job={job_id}

#### 3. Page-Specific Contextual Links
**Files to Modify**:

##### Forecasts Page (`pages/forecasts/index.tsx`)
- **Add Links**:
  - Each forecast card: "View in Terminal" button → opens terminal with symbol, highlights forecast
  - "View Model Details" link → /models/registry/{model_id}
  - "See Related Knowledge" → /knowledge?symbol={symbol}

##### Terminal Page (`pages/terminal.tsx`)
- **Add Links**:
  - "View Forecasts" button next to symbol selector → /forecasts?symbol={current_symbol}
  - "View Strategy Signals" → /analytics?tab=strategies&symbol={symbol}
  - Order history items: "View in Portfolio" → /portfolio?order={order_id}

##### Model Registry (`pages/models/registry/index.tsx`)
- **Add Links**:
  - Each model: "View Forecasts" → /forecasts?model_id={model_id}
  - "View Training Run" → /analytics?tab=learning&model={model_id}
  - "See in Terminal" → /terminal?symbol={model.symbol}

##### Strategies Tab (`pages/analytics/StrategiesTab.tsx`)
- **Add Links**:
  - "View Evolution History" → /analytics?tab=evolution&strategy={strategy_id}
  - "View Forecasts" → /forecasts?symbol={strategy.symbol}
  - "See Trades" → /portfolio?strategy={strategy_id}
  - "View in Terminal" → /terminal?symbol={strategy.symbol}

##### Knowledge Base (`pages/knowledge/index.tsx`)
- **Add Links**:
  - Article mentions symbol: Link to /forecasts?symbol={symbol}
  - Article mentions strategy concept: Link to /analytics?tab=strategies
  - "Apply to Current Market" → /terminal with knowledge context

##### Risk Dashboard (`pages/risk/index.tsx`)
- **Add Links**:
  - Breach items: "View Position" → /portfolio?position={id}
  - "View Trade" → /terminal?order={order_id}
  - "View Strategy" → /analytics?tab=strategies&id={strategy_id}
  - "See Risk Settings" → /settings?tab=trading#risk

##### Evolution Tab (`pages/analytics/EvolutionTab.tsx`)
- **Add Links**:
  - Overfit alerts: "View Model" → /models/registry/{model_id}
  - "View Strategy Details" → /analytics?tab=strategies&id={strategy_id}
  - Evolution run: "View Promoted Strategies" → /analytics?tab=strategies&run={run_id}

##### Portfolio Page (`pages/portfolio.tsx`)
- **Add Links**:
  - Position: "View in Terminal" → /terminal?symbol={position.symbol}
  - "View Strategy" → /analytics?tab=strategies&id={strategy_id}
  - "View Risk Status" → /risk?position={position_id}
  - Trade: "View Forecast" → /forecasts?symbol={symbol}&time={trade_time}

#### 4. Smart Context Menu Component
**Files to Create**:
- `web/next-app/components/navigation/ContextMenu.tsx`
  - Right-click menu for entities
  - Shows relevant actions based on entity type
  - "Open in new tab", "Copy link", "View related"
  - Keyboard shortcut hints

**Usage**:
- Wrap forecast cards, strategy items, model rows
- Right-click shows context menu
- Includes navigation links, actions, copy ID

#### 5. Page State Preservation
**Files to Create**:
- `web/next-app/hooks/usePageState.ts`
  - Saves page filters, sort, scroll position to sessionStorage
  - Restores state when navigating back
  - Clears on manual filter changes

**Implementation**:
- User views /forecasts filtered by BTC/USD
- Clicks "View in Terminal"
- Clicks browser back
- Returns to /forecasts with BTC/USD filter still active

### Integration Points

#### 1. URL Query Parameters for Context
**Standardize query params across pages**:
- `?symbol={symbol}` - Pre-select symbol
- `?highlight={entity_id}` - Highlight specific item
- `?filter={filter_value}` - Apply filter
- `?tab={tab_name}` - Open specific tab
- `?model_id={id}` - Filter by model
- `?strategy_id={id}` - Filter by strategy
- `?from={source_page}` - Track navigation source

**Files to Modify** (Add query param handling):
- `pages/terminal.tsx`
- `pages/forecasts/index.tsx`
- `pages/models/registry/index.tsx`
- `pages/analytics.tsx`
- `pages/portfolio.tsx`
- `pages/risk/index.tsx`

#### 2. Navigation Analytics
**Files to Create**:
- `web/next-app/lib/navigation-analytics.ts`
  - trackNavigation(from, to, link_type)
  - Sends to /api/activity/track
  - Helps identify most-used navigation paths

**Track**:
- Contextual link clicks
- Breadcrumb navigation
- Search result clicks
- Back/forward navigation

#### 3. Link Highlight & Animation
**Files to Modify**:
- When navigating with `?highlight={id}`, scroll to element and pulse border
- Implementation in each page receiving highlight param
- Use Intersection Observer to scroll into view
- 3-second pulse animation on arrival

### Testing Checklist

- [ ] All forecast cards have "View in Terminal" links
- [ ] Terminal → Forecasts navigation works correctly
- [ ] Model → Forecasts linkage functional
- [ ] Strategies → Evolution tab connection working
- [ ] Risk breaches → Portfolio positions link correctly
- [ ] Overfit alerts → Model registry navigation
- [ ] Knowledge articles → Forecasts/Strategies links
- [ ] Breadcrumbs show correct hierarchy on all pages
- [ ] Breadcrumbs are clickable (except current page)
- [ ] URL query parameters preserve context
- [ ] Highlight animation triggers on ?highlight param
- [ ] Context menu appears on right-click
- [ ] Back/forward navigation preserves filters
- [ ] "Open in new tab" works for all links
- [ ] Mobile: breadcrumbs collapse to dropdown

### UI/UX Guidelines

**Link Styling**:
- Primary action: Button (solid)
- Secondary: Button (outline)
- Inline: Underline on hover, text-primary color
- Icon links: Icon with tooltip

**Link Placement**:
- Top-right of cards: Primary action buttons
- Bottom of sections: "View all" links
- Inline in text: Contextual mentions
- Context menu: Right-click

---

## Phase 7.4: Advanced Features & Final Integration

**Timeline**: 1.5 weeks  
**Goal**: Complete remaining features, system-wide polish, and full integration testing

### Backend Tasks

#### 1. System-Wide Settings & Preferences
**Files to Create**:
- `db/repositories/user_preferences_repository.py`
  - get_preferences(user_id)
  - update_preference(user_id, key, value)
  - reset_to_defaults(user_id)

**Database Schema**:
```
Collection: user_preferences
{
  user_id: str,
  ui_preferences: {
    animation_speed: str,  // "fast", "normal", "slow", "none"
    theme: str,  // "light", "dark", "auto"
    default_symbol: str,
    default_horizon: str,
    compact_mode: bool,
    show_breadcrumbs: bool
  },
  navigation_preferences: {
    recent_pages: [str],  // Last 10 visited pages
    pinned_pages: [str],  // User-pinned favorites
    default_landing: str  // Page after login
  },
  data_preferences: {
    default_date_range: str,  // "1d", "1w", "1m"
    refresh_interval: int,  // seconds
    auto_refresh: bool
  },
  updated_at: datetime
}
```

**Files to Create**:
- `api/routes/preferences.py`
  - GET /api/preferences
  - PUT /api/preferences
  - POST /api/preferences/reset
  - GET /api/preferences/pinned-pages
  - POST /api/preferences/pin-page
  - DELETE /api/preferences/pin-page/{page_id}

#### 2. Advanced Batch Operations
**Files to Modify**:
- `api/routes/batch_operations.py`
  - POST /api/batch/bulk-actions - Execute multiple actions (retrain models, refresh forecasts)
  - GET /api/batch/status/{batch_id} - Check batch operation status
  - WebSocket /ws/batch/{batch_id} - Real-time batch progress

**Use Cases**:
- Retrain all stale models (>7 days old)
- Refresh all forecasts for selected symbols
- Bulk export forecasts, strategies, models

#### 3. System Health & Diagnostics
**Files to Create**:
- `monitor/system_health.py`
  - SystemHealthChecker class
  - check_all() → Returns overall system health
  - Checks: Database connectivity, API response times, data freshness, model health, WebSocket status

**Files to Create**:
- `api/routes/system_health.py`
  - GET /api/system/health - Comprehensive health check
  - GET /api/system/diagnostics - Detailed diagnostics
  - GET /api/system/status - Simple up/down status

**Health Response**:
```json
{
  "overall_status": "healthy",  // "healthy", "degraded", "critical"
  "components": {
    "database": {"status": "healthy", "latency_ms": 12},
    "api": {"status": "healthy", "avg_response_time_ms": 145},
    "data_freshness": {"status": "healthy", "last_update": "2024-11-21T10:00:00Z"},
    "models": {"status": "degraded", "stale_count": 5, "fresh_count": 15},
    "websockets": {"status": "healthy", "active_connections": 3}
  },
  "recommendations": [
    "5 models are stale and should be retrained",
    "Consider increasing data ingestion frequency"
  ],
  "timestamp": "2024-11-21T10:30:00Z"
}
```

### Frontend Tasks

#### 1. Advanced Settings Page Enhancements
**Files to Modify**:
- `pages/settings.tsx`
  - Add new tab: "Interface"
  - Animation speed selector (Fast, Normal, Slow, None)
  - Compact mode toggle
  - Default symbol/horizon selectors
  - Breadcrumb visibility toggle
  - Reset to defaults button

**Files to Create**:
- `web/next-app/pages/settings/InterfaceTab.tsx`
  - UI preferences form
  - Live preview of changes
  - Animation speed demo
  - Compact mode comparison

- `web/next-app/pages/settings/NavigationTab.tsx`
  - Pinned pages management (drag to reorder)
  - Default landing page selector
  - Recent pages list (clear button)
  - Navigation history

#### 2. Command Palette (Advanced Search)
**Files to Create**:
- `web/next-app/components/command/CommandPalette.tsx`
  - Alternative to GlobalSearch
  - Triggered with Cmd+P (vs Cmd+K for search)
  - Shows actions, not just entities
  - "Retrain all models", "Export forecasts", "View system health"
  - Recent commands section
  - Organized by category

**Command Categories**:
- **Navigate**: Go to forecasts, terminal, analytics, etc.
- **Actions**: Retrain models, refresh data, export reports
- **Filters**: Apply quick filters (High confidence, Top strategies)
- **Settings**: Change theme, toggle compact mode, adjust preferences
- **Help**: Open documentation, tutorials, keyboard shortcuts

**Files to Create**:
- `web/next-app/hooks/useCommands.ts`
  - Defines available commands
  - Executes command actions
  - Tracks command history

#### 3. System Status Indicator
**Files to Create**:
- `web/next-app/components/system/SystemStatusBadge.tsx`
  - Small badge in footer or header
  - Green: Healthy, Yellow: Degraded, Red: Critical
  - Tooltip shows component status
  - Click opens system health modal

- `web/next-app/components/system/SystemHealthModal.tsx`
  - Full system health details
  - Component status grid
  - Recommendations list
  - "Run diagnostics" button
  - Refresh button to re-check

**Files to Modify**:
- `components/Layout.tsx`
  - Add SystemStatusBadge to footer
  - Polls /api/system/health every 60 seconds

#### 4. Pinned Pages & Favorites
**Files to Create**:
- `web/next-app/components/navigation/PinnedPages.tsx`
  - Quick access bar below header
  - Shows pinned pages as tabs
  - Drag to reorder
  - Click navigates, right-click to unpin

**Files to Modify**:
- `components/Layout.tsx`
  - Add PinnedPages below breadcrumbs (if enabled in prefs)
  - Manage pinned pages state

#### 5. Keyboard Shortcuts Panel
**Files to Create**:
- `web/next-app/components/help/KeyboardShortcuts.tsx`
  - Modal showing all shortcuts
  - Grouped by category (Navigation, Actions, Search)
  - Searchable list
  - Platform-aware (shows Cmd on Mac, Ctrl on Windows)

**Shortcuts to Implement**:
- `Cmd+K`: Open global search
- `Cmd+P`: Open command palette
- `Cmd+/`: Show keyboard shortcuts
- `Cmd+B`: Toggle activity drawer
- `Cmd+,`: Open settings
- `Cmd+1-9`: Navigate to tabs (on analytics page)
- `Esc`: Close modals
- `Arrow keys`: Navigate search results
- `?`: Show help (when not in input)

**Files to Create**:
- `web/next-app/hooks/useKeyboardShortcuts.ts`
  - Registers global shortcuts
  - Handles platform differences
  - Prevents conflicts with inputs
  - Context-aware (different shortcuts per page)

#### 6. Tour & Onboarding Improvements
**Files to Create**:
- `web/next-app/components/tour/InteractiveTour.tsx`
  - Spotlight on elements
  - Step-by-step guide
  - Progress indicator
  - Skip / Next / Previous buttons
  - Tours for each major page

**Tours to Create**:
- Dashboard tour (5 steps)
- Terminal tour (7 steps: chart, order book, place order, etc.)
- Forecasts tour (4 steps)
- Analytics tour (6 steps across tabs)
- Settings tour (3 steps)

**Files to Modify**:
- `pages/get-started.tsx`
  - Add "Take a tour" buttons for each page
  - Progress tracking (X of Y tours completed)

#### 7. Export & Share Features
**Files to Create**:
- `web/next-app/components/export/ExportModal.tsx`
  - Select data to export (forecasts, strategies, models)
  - Date range selector
  - Format: CSV, JSON, PDF (for reports)
  - Export button → Downloads file

**Files to Modify**:
- `pages/forecasts/index.tsx` - Add "Export" button
- `pages/analytics/StrategiesTab.tsx` - Add "Export strategies" button
- `pages/models/registry/index.tsx` - Add "Export model list"
- `pages/portfolio.tsx` - Add "Export transactions"

**Backend Support**:
- Use existing /api/forecast/export
- Create similar endpoints for strategies, models

#### 8. Performance Monitoring Dashboard
**Files to Create**:
- `web/next-app/pages/admin/performance.tsx`
  - Admin-only page
  - Shows API response times (chart)
  - Slow queries list
  - Database performance metrics
  - WebSocket connection status
  - User activity stats

### Integration & Polish Tasks

#### 1. Consistent Error Handling
**Files to Create**:
- `web/next-app/components/errors/ErrorBoundary.tsx`
  - Catches React errors
  - Shows friendly error UI
  - "Report error" button
  - "Reload page" button

- `web/next-app/components/errors/APIErrorAlert.tsx`
  - Standardized API error display
  - Retry button
  - Error details collapse
  - Context-specific messages

**Files to Modify** (Add error boundaries):
- Wrap each major page in ErrorBoundary
- Consistent error alerts for failed API calls

#### 2. Loading State Consistency
**Audit all pages**:
- [ ] Dashboard: Skeleton for metrics cards
- [ ] Terminal: Chart skeleton, order book skeleton
- [ ] Forecasts: Forecast card skeletons
- [ ] Portfolio: Position card skeletons
- [ ] Analytics: Tab-specific skeletons
- [ ] Models: Table skeleton
- [ ] Risk: Breach list skeleton
- [ ] Reports: Report skeleton

#### 3. Empty State Design
**Files to Create**:
- `web/next-app/components/empty/EmptyState.tsx`
  - Illustration or icon
  - Title and description
  - Call-to-action button
  - Used when no data available

**Files to Modify** (Add empty states):
- `pages/forecasts/index.tsx` - "No forecasts yet"
- `pages/models/registry/index.tsx` - "No models trained"
- `pages/analytics/StrategiesTab.tsx` - "No strategies created"
- `pages/knowledge/index.tsx` - "No knowledge articles"
- `pages/portfolio.tsx` - "No positions yet"

#### 4. Mobile Responsiveness Audit
**Check all pages on mobile**:
- [ ] Header navigation collapses to hamburger
- [ ] Tables convert to cards on mobile
- [ ] Charts are touch-scrollable
- [ ] Modals are full-screen on mobile
- [ ] Breadcrumbs collapse
- [ ] Activity drawer is full-width
- [ ] Forms are touch-friendly

#### 5. Accessibility (A11y) Audit
**Check**:
- [ ] All buttons have aria-labels
- [ ] All images have alt text
- [ ] Keyboard navigation works throughout
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA standards
- [ ] Screen reader announcements for dynamic content
- [ ] Skip to main content link

#### 6. Performance Optimization
**Tasks**:
- [ ] Code-split large pages (use next/dynamic)
- [ ] Lazy-load images and charts
- [ ] Implement virtual scrolling for long lists
- [ ] Memoize expensive computations
- [ ] Debounce search and filters
- [ ] Optimize bundle size (analyze with webpack-bundle-analyzer)

**Files to Create**:
- `web/next-app/components/performance/VirtualList.tsx`
  - Virtual scrolling for large lists (forecasts, models)
  - Renders only visible items
  - Smooth scrolling

### Final Integration Testing

#### 1. User Journey Testing
**Test Complete Flows**:
1. **New User Onboarding**:
   - Login → Dashboard → Get Started → Complete Setup → Take Tours → First Trade
   - Check: All animations smooth, no broken links, tooltips helpful

2. **Forecast-to-Trade Flow**:
   - Forecasts → Select high-confidence → View in Terminal → Place Order → View in Portfolio
   - Check: Context preserved, filters work, links navigate correctly

3. **Model Training Flow**:
   - Models → See stale models → Retrain → View progress → Check forecast improvement
   - Check: Notifications arrive, status updates, relationships maintained

4. **Risk Management Flow**:
   - Dashboard → Risk alert → View breach → Navigate to position → Adjust strategy
   - Check: Links work, context clear, actions available

5. **Analytics Deep Dive**:
   - Analytics → Strategies tab → Select strategy → View evolution → Check overfit alerts → Navigate to model
   - Check: Cross-tab navigation, breadcrumbs accurate, data consistent

#### 2. Cross-Browser Testing
**Test on**:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

#### 3. Performance Testing
**Benchmarks**:
- [ ] Page load <2s on 3G
- [ ] Time to interactive <3s
- [ ] First contentful paint <1.5s
- [ ] API response times <500ms (p95)
- [ ] Animation frame rate >50fps

#### 4. Load Testing
**Test**:
- [ ] 100 concurrent users
- [ ] WebSocket connections stable
- [ ] Database queries performant
- [ ] No memory leaks over 24 hours

### Deployment Checklist

#### Backend
- [ ] All new API routes documented
- [ ] Environment variables updated in env.example
- [ ] Database indexes created
- [ ] Migration scripts ready
- [ ] API versioning considered

#### Frontend
- [ ] Build passes without errors
- [ ] No console errors/warnings
- [ ] Environment variables set
- [ ] Analytics tracking enabled
- [ ] Error tracking configured (Sentry)

#### Database
- [ ] All collections indexed
- [ ] Data retention policies set
- [ ] Backup strategy confirmed

#### DevOps
- [ ] Docker images built
- [ ] docker-compose.yml updated
- [ ] Nginx config updated (if needed)
- [ ] Health check endpoints configured
- [ ] Monitoring alerts set up

### Documentation Tasks

**Files to Create**:
- `docs/KEYBOARD_SHORTCUTS.md` - All shortcuts documented
- `docs/NAVIGATION_GUIDE.md` - How to navigate between pages
- `docs/SEARCH_GUIDE.md` - Search syntax and filters
- `docs/API_CHANGELOG.md` - New endpoints added in Phase 7

**Files to Update**:
- `README.md` - Update features list, screenshots
- `docs/UX_IMPROVEMENT_ROADMAP.md` - Mark Phase 7 complete
- API documentation - Add new endpoints

---

## Phase 7 Success Criteria

### User Experience
✅ Users can navigate between any two pages within 2 clicks
✅ All major entities have contextual "View in..." links
✅ Search finds results in <300ms
✅ Animations are smooth (60fps) and respectful (reduced motion support)
✅ Loading states prevent confusion (no flash of content)
✅ Empty states provide clear next steps
✅ Error messages are helpful and actionable

### Technical
✅ No duplicate code across frontend components
✅ All API endpoints follow consistent patterns
✅ Database queries are optimized (indexed)
✅ WebSocket connections are stable
✅ Bundle size optimized (<500KB gzipped main bundle)
✅ Accessibility score >90 (Lighthouse)
✅ Performance score >85 (Lighthouse)

### Integration
✅ All pages connected via breadcrumbs
✅ Activity feed shows real-time updates
✅ Search covers all major entities
✅ Notifications integrate with all events
✅ Risk alerts link to relevant pages
✅ Knowledge articles link to strategies/forecasts

### Business Value
✅ Reduced time to execute trades (via Terminal links)
✅ Faster model management (via contextual retrain)
✅ Improved risk awareness (via proactive alerts)
✅ Better strategy optimization (via Evolution insights)
✅ Enhanced learning curve (via tours and contextual help)

---

## Post-Phase 7 Maintenance

### Monitoring
- Track navigation patterns (most-used links)
- Monitor search queries (improve relevance)
- Watch API performance (slow endpoints)
- Track animation performance (jank detection)

### Iterative Improvements
- Add more search filters based on usage
- Expand contextual links as new relationships discovered
- Refine breadcrumb logic for complex paths
- Optimize animations based on user feedback

### Future Enhancements (Beyond Phase 7)
- AI-powered search (natural language queries)
- Personalized dashboard (learn user preferences)
- Advanced command palette (macro recording)
- Collaborative features (share forecasts, strategies)
- Mobile app (native iOS/Android)

---