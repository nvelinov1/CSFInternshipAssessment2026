# Retrospective - Trade Offs & Next Steps

This document is a retrospective of the FarmTracker application after auditing the codebase, fixing issues, implementing weight logging, and refactoring paddock counts and SQL queries.

### Trade Offs
1. **Introducing a derived column may lead to slower queries**:  
When addressing the architectural issue with inconsistent paddock counts, I used a derived column using a SQL ``COUNT()`` query to fetch paddock counts whenever paddocks are requested. This change could slow down queries as data grows, since animals need to be recounted. I decided to take this trade off as managing the counts using API-level logic introduces more complexity. A different solution could be explored using SQL triggers ensuring consistency.

2. **Introducing JOINs complicates existing SQL queries**:  
When adding the paddock name in the animals listing and optimizing the N+1 query to fetch the latest health event, my changes introduced ``JOINs`` into the ``GET /api/animals`` query, which complicates queries if more data needs to be returned. I decided to proceed regardless, as I prioritized removing the N+1 query, and including the paddock name in the response to display more useful information to the user.

### Next Steps  

1. **Using ORM-based data access**:  
An additional improvement includes introducing an ORM to simplify data access. This provides database-agnostic access, allowing the app to transition to another database if needed. However, ORMs are prone to N+1 queries, so developers can look into built-in ORM query optimizations to mitigate these issues. 

2. **Using template-based HTML rendering**:  
Currently, the frontend uses entire HTML pages, meaning that some markup is repeated for the header, NavBar, and script/stylesheet loading. This causes significant overhead if a change occurs that impacts all pages. Templating engines are available for Express.js, which exchange page content instead of duplicating HTML for every page.
