/**
 * @jest-environment jsdom
 */

/*
  Перенос анонимного прогресса после входа (#52). Правило слияния закрыто
  тестами progressMerge; здесь — что компонент делает на странице: зовёт
  серверное действие с тем, что лежит в localStorage, после успеха чистит
  копию и обновляет страницу, а при сбое оставляет копию и не падает.
*/

import { render, waitFor } from "@testing-library/react";
import LocalProgressMerge from "./LocalProgressMerge";
import { mergeLessonProgress } from "@/actions/progress";
import { useRouter } from "next/navigation";
import { LOCAL_PROGRESS_KEY } from "@/lib/lessonProgress";

jest.mock("@/actions/progress", () => ({ mergeLessonProgress: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));

const mergeMock = jest.mocked(mergeLessonProgress);
const useRouterMock = jest.mocked(useRouter);
const refresh = jest.fn();

const LOCAL = { notation: { stepIndex: 2, completed: false } };

beforeEach(() => {
  localStorage.clear();
  refresh.mockReset();
  mergeMock.mockReset();
  // Новый объект на каждый вызов: эффект с [router] перезапускается на каждой
  // перерисовке, и повторного запроса быть всё равно не должно.
  useRouterMock.mockImplementation(() => ({ refresh }) as unknown as ReturnType<typeof useRouter>);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const stored = () => localStorage.getItem(LOCAL_PROGRESS_KEY);

describe("LocalProgressMerge", () => {
  it("ничего не рисует и не зовёт сервер, когда переносить нечего", async () => {
    const { container } = render(<LocalProgressMerge />);

    expect(container.innerHTML).toBe("");
    await Promise.resolve();
    expect(mergeMock).not.toHaveBeenCalled();
  });

  it("отправляет локальный прогресс, чистит копию и обновляет страницу", async () => {
    localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(LOCAL));
    mergeMock.mockResolvedValue({ success: true, written: 1 });

    render(<LocalProgressMerge />);

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(mergeMock).toHaveBeenCalledWith(LOCAL);
    expect(stored()).toBeNull();
  });

  it("аккаунт уже впереди: копия чистится, страница не обновляется", async () => {
    localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(LOCAL));
    mergeMock.mockResolvedValue({ success: true, written: 0 });

    render(<LocalProgressMerge />);

    await waitFor(() => expect(stored()).toBeNull());
    expect(refresh).not.toHaveBeenCalled();
  });

  it("отказ сервера: копия остаётся до следующей попытки", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(LOCAL));
    mergeMock.mockResolvedValue({ success: false, error: "Войдите" });

    render(<LocalProgressMerge />);

    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(stored()).toBe(JSON.stringify(LOCAL));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("сбой сети не роняет страницу, копия остаётся", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(LOCAL));
    mergeMock.mockRejectedValue(new Error("offline"));

    const { container } = render(<LocalProgressMerge />);

    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(stored()).toBe(JSON.stringify(LOCAL));
    expect(container.innerHTML).toBe("");
  });

  it("за жизнь страницы переносит один раз, сколько бы она ни перерисовывалась", async () => {
    localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(LOCAL));
    mergeMock.mockResolvedValue({ success: true, written: 1 });

    const { rerender } = render(<LocalProgressMerge />);
    rerender(<LocalProgressMerge />);
    rerender(<LocalProgressMerge />);

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(mergeMock).toHaveBeenCalledTimes(1);
  });
});
