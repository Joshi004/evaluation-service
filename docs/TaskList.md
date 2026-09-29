1. Even when recipe contains enable_thinking: false backend/app/services/harness/task_config.py does not CTUALLY PASS enable thinking to evalscope /vllm and qwen3 default behavior is to enable thinking True by default 

2. The split information that is being passed from the recipe is not actually being sent by task_config.PY it works with eval scope because it registered if eval default is indeed a train split, but that is a default behave so the confit is still not respecting the recipe


3. IMplient Per sample , Per Instructio Diagnostic Visibility for If Eval


4. Add feature to delete or edit the servong profile or recipe or reseded teh serving profile with validate endpoint 
