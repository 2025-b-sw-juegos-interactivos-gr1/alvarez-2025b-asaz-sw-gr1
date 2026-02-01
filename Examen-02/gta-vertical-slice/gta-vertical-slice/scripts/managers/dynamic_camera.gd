# dynamic_camera.gd
# Camera that follows the active target (vehicle or pedestrian) with dynamic zoom
extends Camera2D

@export var target: Node2D
@export var zoom_min: float = 0.7
@export var zoom_max: float = 1.0
@export var zoom_speed_threshold: float = 200.0

func _ready() -> void:
	# Set initial zoom
	zoom = Vector2(zoom_max, zoom_max)

func _process(_delta: float) -> void:
	if not is_instance_valid(target):
		return
	
	# Smoothly follow the target
	global_position = lerp(global_position, target.global_position, 0.1)
	
	# Dynamic zoom based on speed (if target is a vehicle)
	if target.has_method("get_current_speed"):
		var speed = target.get_current_speed()
		var target_zoom = remap(speed, 0, zoom_speed_threshold, zoom_max, zoom_min)
		target_zoom = clamp(target_zoom, zoom_min, zoom_max)
		zoom = lerp(zoom, Vector2(target_zoom, target_zoom), 0.05)
	else:
		# If not a vehicle (pedestrian), use max zoom
		zoom = lerp(zoom, Vector2(zoom_max, zoom_max), 0.05)


func _on_player_state_machine_state_changed(new_state, target_node):
	target = target_node
