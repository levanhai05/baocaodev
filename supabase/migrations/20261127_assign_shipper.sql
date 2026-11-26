
-- Phố Burger: Bếp hoàn tất đơn và tự động phân Shipper.
-- Chỉ service_role được gọi hàm này.
-- API server phải xác thực nhân viên trước khi gọi.

CREATE OR REPLACE FUNCTION public.mark_order_ready_and_assign_shipper(
    p_order_id uuid,
    p_kitchen_id uuid,
    p_store_id integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_shipper_id uuid := NULL;
BEGIN
    -- Kiểm tra tài khoản Bếp còn hoạt động và đúng chi nhánh.
    IF NOT EXISTS (
        SELECT 1
        FROM public.staff s
        WHERE s.user_id = p_kitchen_id
          AND s.role = 'kitchen'
          AND s.store_id = p_store_id
          AND s.active = true
    ) THEN
        RAISE EXCEPTION 'Tài khoản Bếp không hợp lệ hoặc không đúng chi nhánh';
    END IF;

    -- Khóa đơn hàng để tránh hai thao tác hoàn tất cùng lúc.
    SELECT *
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id
      AND store_id = p_store_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy đơn hàng trong chi nhánh';
    END IF;

    IF v_order.status <> 'preparing' THEN
        RAISE EXCEPTION 'Đơn hàng không ở trạng thái đang chuẩn bị';
    END IF;

    -- Đơn giao hàng mới cần tìm Shipper.
    -- Đơn tự lấy không cần phân Shipper.
    IF COALESCE(v_order.fulfillment, 'delivery') <> 'pickup' THEN

        SELECT s.user_id
        INTO v_shipper_id
        FROM public.staff s
        WHERE s.role = 'shipper'
          AND s.store_id = p_store_id
          AND s.active = true
        ORDER BY
            (
                SELECT COUNT(*)
                FROM public.orders o
                WHERE o.assigned_shipper_id = s.user_id
                  AND o.status IN ('ready', 'delivering')
            ) ASC,
            s.created_at ASC,
            s.user_id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1;

    END IF;

    -- Chuyển trạng thái và ghi nhận người giao hàng.
    UPDATE public.orders
    SET
        status = 'ready',
        ready_at = NOW(),
        assigned_shipper_id = v_shipper_id
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'assigned_shipper_id', v_shipper_id,
        'message',
            CASE
                WHEN COALESCE(v_order.fulfillment, 'delivery') = 'pickup'
                    THEN 'Đơn tự lấy đã sẵn sàng'
                WHEN v_shipper_id IS NOT NULL
                    THEN 'Đã phân công Shipper'
                ELSE 'Đơn đã sẵn sàng nhưng chưa có Shipper'
            END
    );
END;
$$;

-- Không cho khách hoặc nhân viên tự gọi hàm RPC.
REVOKE ALL ON FUNCTION
public.mark_order_ready_and_assign_shipper(uuid, uuid, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.mark_order_ready_and_assign_shipper(uuid, uuid, integer)
TO service_role;
