# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Auto-save simulation runs when completed
- Pin feature to protect runs from auto-deletion when storage is full
- Simulation history side panel with compressed localStorage persistence
- Loading spinner and overlay for instant mode simulation
- Chunked processing (1000 steps) for smoother instant mode UX
- P50/P90/Worst statistics for all resources (crystals, scrolls, silver) in strategy pages
- Settings drawer with market prices and game constants
- Success count column in anvil pity table
- Hepta/Okta completion now counts in level success statistics

### Fixed
- Reset startHepta/startOkta when startLevel changes to non-applicable level
- Strategy finder now uses fixed startLevel=0 for accurate analysis
- Storage version and proper defaults merging for config persistence

### Changed
- Strategy tables now use grouped column headers for better organization
- Improved UX with visual feedback during calculations

## [0.1.0] - 2025-01-07

### Added
- Initial release with full awakening enhancement simulation
- Support for enhancement levels I-X with accurate success rates
- Anvil pity system tracking (Ancient Anvil)
- Restoration scroll system with 50% success rate
- Advice of Valks support (+10%, +50%, +100%)
- Hepta path (VII→VIII) with 5 sub-enhancements
- Okta path (VIII→IX) with 10 sub-enhancements
- Monte Carlo strategy analysis for restoration optimization
- Monte Carlo strategy analysis for Hepta/Okta comparison
- Real-time simulation with step-by-step log
- Three simulation speeds: instant, fast, regular
- Resource tracking (crystals, scrolls, silver, exquisite crystals)
- Market price configuration for silver cost calculations
- Responsive dark theme UI
