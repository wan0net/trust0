<script>
	import { page } from "$app/state";
</script>

<div class="error-state">
	<div class="error-state-icon">&#9670;</div>
	<div class="error-state-title">{page.status}</div>
	<div class="error-state-msg">{page.error?.message || "Something went wrong"}</div>
	<a href="/" class="error-state-link">Go home</a>
</div>
