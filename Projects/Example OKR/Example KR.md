---
tags:
  - KR
success metric:
  description: Success when current = objective
  current: 25
  objective: 100
warning metric:
  description: Warn when current is not in range of below -> above. # I usually use a percentage.
  current: 50 
  below: 75
  above: 100
deadline: 2022-12-31
scheduled: false 
---

```dataviewjs
const {OKR} = customJS;
OKR.kr(dv);
```