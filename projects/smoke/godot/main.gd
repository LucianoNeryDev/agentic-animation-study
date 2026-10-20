extends Node2D

func _ready() -> void:
	RenderingServer.set_default_clear_color(Color("#202028"))
	var from := 0
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--from="):
			from = int(a.get_slice("=", 1))
	var box := ColorRect.new()
	box.color = Color("#e6a700")
	box.size = Vector2(60, 60)
	box.position = Vector2(40, 150)
	add_child(box)
	var tw := create_tween()
	tw.tween_property(box, "position:x", 540.0, 1.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	tw.custom_step(from / 30.0)
	print("SMOKE renderer=", RenderingServer.get_video_adapter_name(), " method=", ProjectSettings.get_setting("rendering/renderer/rendering_method"), " from=", from)
